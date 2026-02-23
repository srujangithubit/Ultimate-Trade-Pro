import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradingAccount } from './entities/trading-account.entity';
import { Trade } from '../trades/entities/trade.entity';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';
import * as crypto from 'crypto';

@Injectable()
export class AccountsService {
    constructor(
        @InjectRepository(TradingAccount)
        private readonly accountRepo: Repository<TradingAccount>,
        @InjectRepository(Trade)
        private readonly tradeRepo: Repository<Trade>,
    ) { }

    private generateApiKey(): { raw: string; hash: string } {
        const raw = `tp_${crypto.randomBytes(32).toString('hex')}`;
        const hash = crypto.createHash('sha256').update(raw).digest('hex');
        return { raw, hash };
    }

    hashApiKey(raw: string): string {
        return crypto.createHash('sha256').update(raw).digest('hex');
    }

    async create(userId: string, dto: CreateAccountDto) {
        const { raw, hash } = this.generateApiKey();

        const account = this.accountRepo.create({
            userId,
            name: dto.name || `Account ${dto.accountLogin}`,
            broker: dto.broker,
            server: dto.server,
            accountLogin: dto.accountLogin,
            accountType: dto.accountType || 'live',
            currency: dto.currency || 'USD',
            apiKeyHash: hash,
            active: true,
        });

        const saved = await this.accountRepo.save(account);

        return {
            ...saved,
            apiKey: raw,
        };
    }

    async findAll(userId: string) {
        const accounts = await this.accountRepo.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });

        const enriched = await Promise.all(
            accounts.map(async (account) => {
                const trades = await this.tradeRepo.find({
                    where: { userId, accountId: account.id },
                    select: ['pnlNet'],
                });

                const totalTrades = trades.length;
                const wins = trades.filter((t) => Number(t.pnlNet) > 0).length;
                const totalPnl = trades.reduce(
                    (sum, t) => sum + (Number(t.pnlNet) || 0),
                    0,
                );

                let peak = Number(account.balance);
                let maxDrawdown = 0;
                let running = peak;
                for (const trade of trades) {
                    running += Number(trade.pnlNet) || 0;
                    if (running > peak) peak = running;
                    const dd = peak > 0 ? ((peak - running) / peak) * 100 : 0;
                    if (dd > maxDrawdown) maxDrawdown = dd;
                }

                const isOnline =
                    account.lastSeen &&
                    new Date().getTime() - new Date(account.lastSeen).getTime() < 90000;

                return {
                    ...account,
                    totalTrades,
                    winRate:
                        totalTrades > 0
                            ? Number(((wins / totalTrades) * 100).toFixed(2))
                            : 0,
                    totalPnl: Number(totalPnl.toFixed(2)),
                    maxDrawdown: Number(maxDrawdown.toFixed(2)),
                    status: isOnline ? 'CONNECTED' : 'OFFLINE',
                };
            }),
        );

        return enriched;
    }

    async findOne(userId: string, id: string) {
        const account = await this.accountRepo.findOne({ where: { id } });

        if (!account) throw new NotFoundException('Account not found');
        if (account.userId !== userId)
            throw new ForbiddenException('Access denied');

        return account;
    }

    async update(userId: string, id: string, dto: UpdateAccountDto) {
        await this.findOne(userId, id);

        await this.accountRepo.update(id, dto);
        return this.accountRepo.findOne({ where: { id } });
    }

    async toggle(userId: string, id: string) {
        const account = await this.findOne(userId, id);

        await this.accountRepo.update(id, { active: !account.active });
        return this.accountRepo.findOne({ where: { id } });
    }

    async regenerateKey(userId: string, id: string) {
        await this.findOne(userId, id);
        const { raw, hash } = this.generateApiKey();

        await this.accountRepo.update(id, { apiKeyHash: hash });

        return { apiKey: raw };
    }

    async remove(userId: string, id: string) {
        await this.findOne(userId, id);
        await this.accountRepo.delete(id);
    }

    async getStats(userId: string, id: string) {
        await this.findOne(userId, id);

        const trades = await this.tradeRepo.find({
            where: { userId, accountId: id },
            order: { entryDatetime: 'ASC' },
        });

        const totalTrades = trades.length;
        if (totalTrades === 0) {
            return {
                totalTrades: 0,
                winRate: 0,
                totalPnl: 0,
                avgPnl: 0,
                profitFactor: 0,
                maxDrawdown: 0,
                bestTrade: 0,
                worstTrade: 0,
                avgWin: 0,
                avgLoss: 0,
                expectancy: 0,
                equityCurve: [],
            };
        }

        let wins = 0;
        let grossProfit = 0;
        let grossLoss = 0;
        let totalPnl = 0;
        let bestTrade = -Infinity;
        let worstTrade = Infinity;
        const winAmounts: number[] = [];
        const lossAmounts: number[] = [];

        let equity = 0;
        let peak = 0;
        let maxDrawdown = 0;
        const equityCurve: { date: string; equity: number }[] = [];

        for (const trade of trades) {
            const pnl = Number(trade.pnlNet) || 0;
            totalPnl += pnl;
            equity += pnl;

            if (pnl > 0) {
                wins++;
                grossProfit += pnl;
                winAmounts.push(pnl);
            } else {
                grossLoss += Math.abs(pnl);
                lossAmounts.push(Math.abs(pnl));
            }

            if (pnl > bestTrade) bestTrade = pnl;
            if (pnl < worstTrade) worstTrade = pnl;

            if (equity > peak) peak = equity;
            const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
            if (dd > maxDrawdown) maxDrawdown = dd;

            equityCurve.push({
                date: trade.exitDatetime
                    ? new Date(trade.exitDatetime).toISOString().split('T')[0]
                    : new Date(trade.entryDatetime).toISOString().split('T')[0],
                equity: Number(equity.toFixed(2)),
            });
        }

        const avgWin =
            winAmounts.length > 0
                ? winAmounts.reduce((a, b) => a + b, 0) / winAmounts.length
                : 0;
        const avgLoss =
            lossAmounts.length > 0
                ? lossAmounts.reduce((a, b) => a + b, 0) / lossAmounts.length
                : 0;
        const winRate = (wins / totalTrades) * 100;
        const expectancy =
            (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;

        return {
            totalTrades,
            winRate: Number(winRate.toFixed(2)),
            totalPnl: Number(totalPnl.toFixed(2)),
            avgPnl: Number((totalPnl / totalTrades).toFixed(2)),
            profitFactor:
                grossLoss === 0
                    ? grossProfit
                    : Number((grossProfit / grossLoss).toFixed(2)),
            maxDrawdown: Number(maxDrawdown.toFixed(2)),
            bestTrade: Number(bestTrade.toFixed(2)),
            worstTrade: Number(worstTrade.toFixed(2)),
            avgWin: Number(avgWin.toFixed(2)),
            avgLoss: Number(avgLoss.toFixed(2)),
            expectancy: Number(expectancy.toFixed(2)),
            equityCurve,
        };
    }

    async findByApiKeyHash(hash: string) {
        return this.accountRepo.findOne({
            where: { apiKeyHash: hash, active: true },
        });
    }
}
