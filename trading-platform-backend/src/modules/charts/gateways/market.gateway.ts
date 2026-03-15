import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { CandleService } from '../services/candle.service';
import { IndicatorService } from '../services/indicator.service';
import { ExecutionService } from '../services/execution.service';
import { MARKET_EVENTS } from '../constants';

interface SubscribePayload {
    symbol: string;
    timeframe: string;
}

@WebSocketGateway({
    namespace: '/market',
    cors: { origin: '*' },
})
export class MarketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(MarketGateway.name);

    @WebSocketServer()
    server: Server;

    /** Track room subscribers: Map<roomKey, Set<socketId>> */
    private readonly roomSubscribers = new Map<string, Set<string>>();

    private unsubCandle: (() => void) | null = null;
    private unsubIndicator: (() => void) | null = null;
    private unsubExecution: (() => void) | null = null;

    constructor(
        private readonly candleService: CandleService,
        private readonly indicatorService: IndicatorService,
        private readonly executionService: ExecutionService,
    ) { }

    afterInit(): void {
        this.logger.log('MarketGateway initialized on /market namespace');

        // Forward candle updates to appropriate rooms
        this.unsubCandle = this.candleService.onCandleUpdate((event) => {
            const room = `${event.symbol}:${event.timeframe}`;
            this.server.to(room).emit(MARKET_EVENTS.CANDLE_UPDATE, event);
        });

        // Forward indicator updates
        this.unsubIndicator = this.indicatorService.onIndicatorUpdate((payload) => {
            const room = `${payload.symbol}:${payload.timeframe}`;
            this.server.to(room).emit(MARKET_EVENTS.INDICATOR_UPDATE, payload);
        });

        // Forward execution events
        this.unsubExecution = this.executionService.onExecutionEvent((event) => {
            if (event.type === 'order_filled' || event.type === 'order_placed' || event.type === 'order_cancelled') {
                this.server.emit(MARKET_EVENTS.ORDER_EVENT, event);
            }
            if (event.type === 'order_filled') {
                this.server.emit(MARKET_EVENTS.POSITION_UPDATE, event.position);
            }
            if (event.type === 'position_closed') {
                this.server.emit(MARKET_EVENTS.POSITION_UPDATE, event.position);
            }
        });
    }

    handleConnection(client: Socket): void {
        this.logger.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket): void {
        this.logger.log(`Client disconnected: ${client.id}`);
        // Clean up room subscriptions
        for (const [room, subs] of this.roomSubscribers) {
            subs.delete(client.id);
            if (subs.size === 0) {
                this.roomSubscribers.delete(room);
            }
        }
    }

    @SubscribeMessage(MARKET_EVENTS.SUBSCRIBE)
    async handleSubscribe(
        @MessageBody() data: SubscribePayload,
        @ConnectedSocket() client: Socket,
    ): Promise<void> {
        const room = `${data.symbol}:${data.timeframe}`;
        client.join(room);

        if (!this.roomSubscribers.has(room)) {
            this.roomSubscribers.set(room, new Set());
        }
        this.roomSubscribers.get(room)!.add(client.id);

        this.logger.log(`Client ${client.id} subscribed to ${room}`);

        // Send initial snapshot of last 500 candles
        try {
            const to = new Date();
            const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days back
            const candles = await this.candleService.getHistoricalCandles(
                data.symbol,
                data.timeframe,
                from,
                to,
            );

            // Send only last 500
            const snapshot = candles.slice(-500);
            client.emit(MARKET_EVENTS.CANDLE_UPDATE, {
                symbol: data.symbol,
                timeframe: data.timeframe,
                candles: snapshot,
                snapshot: true,
            });
        } catch (err) {
            this.logger.error(`Failed to send snapshot to ${client.id}`, err);
        }
    }

    @SubscribeMessage(MARKET_EVENTS.UNSUBSCRIBE)
    handleUnsubscribe(
        @MessageBody() data: SubscribePayload,
        @ConnectedSocket() client: Socket,
    ): void {
        const room = `${data.symbol}:${data.timeframe}`;
        client.leave(room);

        const subs = this.roomSubscribers.get(room);
        if (subs) {
            subs.delete(client.id);
            if (subs.size === 0) {
                this.roomSubscribers.delete(room);
            }
        }

        this.logger.log(`Client ${client.id} unsubscribed from ${room}`);
    }

    @SubscribeMessage(MARKET_EVENTS.PING)
    handlePing(
        @MessageBody() data: { timestamp: number },
        @ConnectedSocket() client: Socket,
    ): void {
        client.emit(MARKET_EVENTS.PONG, { timestamp: data.timestamp });
    }

    /**
     * Broadcast a tick to all subscribed clients.
     * Called by the charts module when processing ticks.
     */
    broadcastTick(symbol: string, tick: { bid: number; ask: number; last: number; volume: number; timestamp: number }): void {
        // Broadcast to all rooms that match the symbol (any timeframe)
        for (const room of this.roomSubscribers.keys()) {
            if (room.startsWith(`${symbol}:`)) {
                this.server.to(room).emit(MARKET_EVENTS.TICK, { symbol, ...tick });
            }
        }
    }

    /**
     * Broadcast risk update to all connected clients.
     */
    broadcastRiskUpdate(data: Record<string, unknown>): void {
        this.server.emit(MARKET_EVENTS.RISK_UPDATE, data);
    }

    /**
     * Broadcast account snapshot.
     */
    broadcastAccountSnapshot(data: Record<string, unknown>): void {
        this.server.emit(MARKET_EVENTS.ACCOUNT_SNAPSHOT, data);
    }
}
