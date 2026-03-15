import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ChartOrderEntity } from '../entities/chart-order.entity';
import { ChartPositionEntity } from '../entities/chart-position.entity';
import { RiskService } from './risk.service';
import { CreateOrderDto } from '../dto';

@Injectable()
export class ExecutionService {
    private readonly logger = new Logger(ExecutionService.name);

    /** Pending limit/stop orders awaiting price trigger */
    private readonly pendingOrders = new Map<string, ChartOrderEntity>();

    /** Listeners for execution events */
    private executionListeners: Array<(event: ExecutionEvent) => void> = [];

    constructor(
        @InjectRepository(ChartOrderEntity)
        private readonly orderRepo: Repository<ChartOrderEntity>,
        @InjectRepository(ChartPositionEntity)
        private readonly positionRepo: Repository<ChartPositionEntity>,
        private readonly riskService: RiskService,
    ) {
        this.loadPendingOrders().catch((err) => this.logger.error('Failed to load pending orders', err));
    }

    onExecutionEvent(listener: (event: ExecutionEvent) => void): () => void {
        this.executionListeners.push(listener);
        return () => {
            this.executionListeners = this.executionListeners.filter((l) => l !== listener);
        };
    }

    /**
     * Submit a new order. Market orders fill immediately.
     * Limit and Stop orders are queued for price-trigger evaluation.
     */
    async submitOrder(dto: CreateOrderDto, accountId: string, currentBid: number, currentAsk: number): Promise<ChartOrderEntity> {
        const order = this.orderRepo.create({
            accountId,
            symbol: dto.symbol,
            side: dto.side,
            type: dto.type,
            volume: String(dto.volume),
            price: dto.price !== undefined ? String(dto.price) : null,
            sl: dto.sl !== undefined ? String(dto.sl) : null,
            tp: dto.tp !== undefined ? String(dto.tp) : null,
            status: 'pending',
        });

        const savedOrder = await this.orderRepo.save(order);

        if (dto.type === 'market') {
            const fillPrice = dto.side === 'buy' ? currentAsk : currentBid;
            return this.fillOrder(savedOrder, fillPrice);
        }

        // Queue limit/stop order
        this.pendingOrders.set(savedOrder.id, savedOrder);
        this.emit({ type: 'order_placed', order: savedOrder });
        return savedOrder;
    }

    /**
     * Cancel a pending order.
     */
    async cancelOrder(orderId: string): Promise<ChartOrderEntity | null> {
        const order = await this.orderRepo.findOne({ where: { id: orderId } });
        if (!order || order.status !== 'pending') return null;

        order.status = 'cancelled';
        const saved = await this.orderRepo.save(order);
        this.pendingOrders.delete(orderId);
        this.emit({ type: 'order_cancelled', order: saved });
        return saved;
    }

    /**
     * Close an open position at the given price.
     */
    async closePosition(positionId: string, currentBid: number, currentAsk: number): Promise<ChartPositionEntity | null> {
        const position = await this.positionRepo.findOne({ where: { id: positionId, closedAt: IsNull() } });
        if (!position) return null;

        const closePrice = position.side === 'buy' ? currentBid : currentAsk;
        const openP = parseFloat(position.openPrice);
        const vol = parseFloat(position.volume);
        const symbolConfig = this.riskService['getSymbolConfig'](position.symbol);
        const pipValue = symbolConfig?.pipValue ?? 10;
        const pipSize = symbolConfig?.pipSize ?? 0.0001;

        let pnl: number;
        if (position.side === 'buy') {
            pnl = ((closePrice - openP) / pipSize) * vol * pipValue;
        } else {
            pnl = ((openP - closePrice) / pipSize) * vol * pipValue;
        }

        position.currentPrice = String(closePrice);
        position.pnl = String(pnl);
        position.closedAt = new Date();

        const saved = await this.positionRepo.save(position);
        this.emit({ type: 'position_closed', position: saved });
        return saved;
    }

    /**
     * Evaluate pending orders against current price.
     * Called on each tick to check if limit/stop orders should fill.
     */
    evaluatePendingOrders(symbol: string, bid: number, ask: number): void {
        for (const [id, order] of this.pendingOrders) {
            if (order.symbol !== symbol) continue;
            if (order.price === null) continue;

            const orderPrice = parseFloat(order.price);

            if (order.type === 'limit') {
                // Buy limit: fill when ask drops to or below order price
                if (order.side === 'buy' && ask <= orderPrice) {
                    this.fillOrder(order, ask).catch((err) => this.logger.error('Fill error', err));
                    this.pendingOrders.delete(id);
                }
                // Sell limit: fill when bid rises to or above order price
                if (order.side === 'sell' && bid >= orderPrice) {
                    this.fillOrder(order, bid).catch((err) => this.logger.error('Fill error', err));
                    this.pendingOrders.delete(id);
                }
            } else if (order.type === 'stop') {
                // Buy stop: fill when ask rises to or above order price
                if (order.side === 'buy' && ask >= orderPrice) {
                    this.fillOrder(order, ask).catch((err) => this.logger.error('Fill error', err));
                    this.pendingOrders.delete(id);
                }
                // Sell stop: fill when bid drops to or below order price
                if (order.side === 'sell' && bid <= orderPrice) {
                    this.fillOrder(order, bid).catch((err) => this.logger.error('Fill error', err));
                    this.pendingOrders.delete(id);
                }
            }
        }
    }

    /**
     * Check trailing stops and SL/TP on open positions.
     */
    async evaluatePositionStops(symbol: string, bid: number, ask: number): Promise<void> {
        const openPositions = await this.positionRepo.find({
            where: { symbol, closedAt: IsNull() },
        });

        for (const pos of openPositions) {
            const currentPrice = pos.side === 'buy' ? bid : ask;

            // Check SL
            if (pos.sl !== null) {
                const sl = parseFloat(pos.sl);
                if (pos.side === 'buy' && currentPrice <= sl) {
                    await this.closePosition(pos.id, bid, ask);
                    continue;
                }
                if (pos.side === 'sell' && currentPrice >= sl) {
                    await this.closePosition(pos.id, bid, ask);
                    continue;
                }
            }

            // Check TP
            if (pos.tp !== null) {
                const tp = parseFloat(pos.tp);
                if (pos.side === 'buy' && currentPrice >= tp) {
                    await this.closePosition(pos.id, bid, ask);
                    continue;
                }
                if (pos.side === 'sell' && currentPrice <= tp) {
                    await this.closePosition(pos.id, bid, ask);
                    continue;
                }
            }

            // Update current price
            pos.currentPrice = String(currentPrice);
            await this.positionRepo.save(pos);
        }
    }

    async getOrders(accountId: string): Promise<ChartOrderEntity[]> {
        return this.orderRepo.find({
            where: { accountId },
            order: { createdAt: 'DESC' },
            take: 100,
        });
    }

    async getPositions(accountId: string, status?: 'open' | 'closed'): Promise<ChartPositionEntity[]> {
        if (status === 'open') {
            return this.positionRepo.find({ where: { accountId, closedAt: IsNull() }, order: { openedAt: 'DESC' } });
        }
        if (status === 'closed') {
            return this.positionRepo
                .createQueryBuilder('p')
                .where('p.accountId = :accountId', { accountId })
                .andWhere('p.closedAt IS NOT NULL')
                .orderBy('p.closedAt', 'DESC')
                .take(200)
                .getMany();
        }
        return this.positionRepo.find({ where: { accountId }, order: { openedAt: 'DESC' }, take: 200 });
    }

    // ── Private Methods ────────────────────────────────────────────────────

    private async fillOrder(order: ChartOrderEntity, fillPrice: number): Promise<ChartOrderEntity> {
        order.status = 'filled';
        order.filledAt = new Date();
        const savedOrder = await this.orderRepo.save(order);

        // Create position
        const position = this.positionRepo.create({
            accountId: order.accountId,
            symbol: order.symbol,
            side: order.side,
            volume: order.volume,
            openPrice: String(fillPrice),
            currentPrice: String(fillPrice),
            sl: order.sl,
            tp: order.tp,
            pnl: '0',
            openedAt: new Date(),
        });

        const savedPosition = await this.positionRepo.save(position);
        this.emit({ type: 'order_filled', order: savedOrder, position: savedPosition });
        return savedOrder;
    }

    private async loadPendingOrders(): Promise<void> {
        const pending = await this.orderRepo.find({ where: { status: 'pending' as const } });
        for (const order of pending) {
            this.pendingOrders.set(order.id, order);
        }
        this.logger.log(`Loaded ${pending.length} pending orders`);
    }

    private emit(event: ExecutionEvent): void {
        for (const listener of this.executionListeners) {
            try {
                listener(event);
            } catch (err) {
                this.logger.error('Execution listener error', err);
            }
        }
    }
}

export type ExecutionEvent =
    | { type: 'order_placed'; order: ChartOrderEntity }
    | { type: 'order_filled'; order: ChartOrderEntity; position: ChartPositionEntity }
    | { type: 'order_cancelled'; order: ChartOrderEntity }
    | { type: 'position_closed'; position: ChartPositionEntity };
