import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Not, IsNull } from 'typeorm';
import { ChartPositionEntity } from '../entities/chart-position.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { QueryPerformanceDto } from '../dto';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
    user: { userId: string };
}

interface PerformanceStats {
    netPnl: number;
    winRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
    profitFactor: number;
    expectancy: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    avgWin: number;
    avgLoss: number;
}

interface EquityCurvePoint {
    date: string;
    equity: number;
    drawdown: number;
    benchmark: number;
}

@Controller('charts/performance')
@UseGuards(JwtAuthGuard)
export class PerformanceController {
    constructor(
        @InjectRepository(ChartPositionEntity)
        private readonly positionRepo: Repository<ChartPositionEntity>,
    ) { }

    @Get()
    async getPerformance(
        @Req() req: AuthenticatedRequest,
        @Query() query: QueryPerformanceDto,
    ) {
        const accountId = req.user.userId;

        const whereClause: Record<string, unknown> = {
            accountId,
            closedAt: Not(IsNull()),
        };

        if (query.from) {
            whereClause.closedAt = MoreThanOrEqual(new Date(query.from));
        }

        const closedPositions = await this.positionRepo.find({
            where: whereClause,
            order: { closedAt: 'ASC' },
        });

        return {
            stats: this.computeStats(closedPositions),
            equityCurve: this.computeEquityCurve(closedPositions),
        };
    }

    private computeStats(positions: ChartPositionEntity[]): PerformanceStats {
        if (positions.length === 0) {
            return {
                netPnl: 0, winRate: 0, maxDrawdown: 0, sharpeRatio: 0,
                profitFactor: 0, expectancy: 0, totalTrades: 0,
                winningTrades: 0, losingTrades: 0, avgWin: 0, avgLoss: 0,
            };
        }

        const pnls = positions.map((p) => parseFloat(p.pnl));
        const wins = pnls.filter((p) => p > 0);
        const losses = pnls.filter((p) => p < 0);

        const netPnl = pnls.reduce((sum, p) => sum + p, 0);
        const winRate = (wins.length / pnls.length) * 100;
        const avgWin = wins.length > 0 ? wins.reduce((s, p) => s + p, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((s, p) => s + p, 0) / losses.length : 0;
        const grossProfit = wins.reduce((s, p) => s + p, 0);
        const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
        const expectancy = pnls.length > 0 ? netPnl / pnls.length : 0;

        // Max drawdown
        let peak = 0;
        let maxDD = 0;
        let cumPnl = 0;
        for (const pnl of pnls) {
            cumPnl += pnl;
            if (cumPnl > peak) peak = cumPnl;
            const dd = peak - cumPnl;
            if (dd > maxDD) maxDD = dd;
        }

        // Sharpe ratio (annualized, assuming daily returns)
        const mean = pnls.length > 0 ? netPnl / pnls.length : 0;
        const variance = pnls.length > 1
            ? pnls.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / (pnls.length - 1)
            : 0;
        const stdDev = Math.sqrt(variance);
        const sharpeRatio = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;

        return {
            netPnl: roundTo(netPnl, 2),
            winRate: roundTo(winRate, 1),
            maxDrawdown: roundTo(maxDD, 2),
            sharpeRatio: roundTo(sharpeRatio, 2),
            profitFactor: roundTo(profitFactor, 2),
            expectancy: roundTo(expectancy, 2),
            totalTrades: pnls.length,
            winningTrades: wins.length,
            losingTrades: losses.length,
            avgWin: roundTo(avgWin, 2),
            avgLoss: roundTo(avgLoss, 2),
        };
    }

    private computeEquityCurve(positions: ChartPositionEntity[]): EquityCurvePoint[] {
        if (positions.length === 0) return [];

        const initialEquity = 100000;
        let cumulativeEquity = initialEquity;
        let peak = initialEquity;
        const curve: EquityCurvePoint[] = [];

        // Group by date
        const byDate = new Map<string, number>();
        for (const pos of positions) {
            const date = pos.closedAt ? pos.closedAt.toISOString().split('T')[0] : '';
            if (!date) continue;
            const existing = byDate.get(date) ?? 0;
            byDate.set(date, existing + parseFloat(pos.pnl));
        }

        let tradeIndex = 0;
        for (const [date, dailyPnl] of byDate) {
            cumulativeEquity += dailyPnl;
            if (cumulativeEquity > peak) peak = cumulativeEquity;
            const drawdown = peak - cumulativeEquity;

            // Simple buy-and-hold benchmark (linear growth assumption)
            tradeIndex++;
            const benchmark = initialEquity * (1 + 0.0001 * tradeIndex);

            curve.push({
                date,
                equity: roundTo(cumulativeEquity, 2),
                drawdown: roundTo(drawdown, 2),
                benchmark: roundTo(benchmark, 2),
            });
        }

        return curve;
    }
}

function roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}
