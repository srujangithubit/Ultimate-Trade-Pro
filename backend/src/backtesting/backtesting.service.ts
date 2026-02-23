import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto, ExecuteOrderDto } from './dto/backtesting.dto';

@Injectable()
export class BacktestingService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Create a new backtesting session for a user.
     */
    async createSession(userId: string, dto: CreateSessionDto) {
        return this.prisma.backtestingSession.create({
            data: {
                userId,
                name: dto.sessionName,
                accountId: dto.accountId ?? null,
                status: 'created',
                configuration: {
                    instrument: dto.instrument,
                    assetClass: dto.assetClass,
                    startingBalance: dto.startingBalance,
                    startDate: dto.startDate,
                    endDate: dto.endDate,
                },
            },
        });
    }

    /**
     * Get a session by ID, ensuring it belongs to the requesting user.
     */
    async getSession(userId: string, sessionId: string) {
        const session = await this.prisma.backtestingSession.findUnique({
            where: { id: sessionId },
            include: { trades: true, snapshots: true },
        });

        if (!session || session.userId !== userId) {
            throw new NotFoundException('Session not found');
        }

        return session;
    }

    /**
     * List all sessions for a user, ordered by most recent first.
     */
    async listSessions(userId: string) {
        return this.prisma.backtestingSession.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Execute an order within a backtesting session.
     */
    async executeOrder(
        userId: string,
        sessionId: string,
        dto: ExecuteOrderDto,
    ) {
        const session = await this.getSession(userId, sessionId);

        if (session.status === 'completed') {
            throw new BadRequestException('Cannot execute orders on a completed session');
        }

        const config = session.configuration as Record<string, any>;

        // Create the trade record
        const trade = await this.prisma.trade.create({
            data: {
                userId,
                accountId: session.accountId ?? undefined,
                backtestSessionId: sessionId,
                symbol: config.instrument,
                direction: dto.direction,
                entryDate: session.currentTime ?? new Date(),
                entryPrice: dto.price ?? 0,
                quantity: dto.quantity,
                status: 'OPEN',
                notes: dto.notes ?? null,
            },
        });

        return trade;
    }

    /**
     * Close an open trade in a backtesting session.
     */
    async closeTrade(
        userId: string,
        sessionId: string,
        tradeId: string,
        exitPrice: number,
    ) {
        // Verify session ownership
        await this.getSession(userId, sessionId);

        const trade = await this.prisma.trade.findUnique({
            where: { id: tradeId },
        });

        if (!trade || trade.backtestSessionId !== sessionId) {
            throw new NotFoundException('Trade not found in this session');
        }

        if (trade.status !== 'OPEN') {
            throw new BadRequestException('Trade is not open');
        }

        const entryPrice = Number(trade.entryPrice);
        const quantity = Number(trade.quantity);
        const pnlGross =
            trade.direction === 'long'
                ? (exitPrice - entryPrice) * quantity
                : (entryPrice - exitPrice) * quantity;

        const fees = Number(trade.fees) || 0;
        const pnlNet = pnlGross - fees;

        return this.prisma.trade.update({
            where: { id: tradeId },
            data: {
                exitPrice,
                exitDate: new Date(),
                pnlGross,
                pnlNet,
                status: 'CLOSED',
            },
        });
    }

    /**
     * Update session status (e.g. 'active', 'paused', 'completed').
     */
    async updateSessionStatus(
        userId: string,
        sessionId: string,
        status: string,
    ) {
        await this.getSession(userId, sessionId);

        return this.prisma.backtestingSession.update({
            where: { id: sessionId },
            data: { status },
        });
    }

    /**
     * Delete a session and its associated data.
     */
    async deleteSession(userId: string, sessionId: string) {
        await this.getSession(userId, sessionId);

        return this.prisma.backtestingSession.delete({
            where: { id: sessionId },
        });
    }
}