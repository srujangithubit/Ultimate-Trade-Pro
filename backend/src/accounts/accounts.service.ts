import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';
import * as crypto from 'crypto';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate a raw API key and its SHA-256 hash.
   * The raw key is returned once; only the hash is stored.
   */
  private generateApiKey(): { raw: string; hash: string } {
    const raw = `tp_${crypto.randomBytes(32).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return { raw, hash };
  }

  /**
   * Hash a raw API key for lookup.
   */
  hashApiKey(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Create a new trading account and generate an API key.
   */
  async create(userId: string, dto: CreateAccountDto) {
    const { raw, hash } = this.generateApiKey();

    const account = await this.prisma.tradingAccount.create({
      data: {
        userId,
        name: dto.name,
        broker: dto.broker,
        accountType: dto.accountType || 'live',
        currency: dto.currency || 'USD',
        apiKeyHash: hash,
        active: true,
      },
    });

    return {
      ...account,
      apiKey: raw, // Only returned once at creation
    };
  }

  /**
   * List all accounts for a user with trade stats.
   */
  async findAll(userId: string) {
    const accounts = await this.prisma.tradingAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with trade stats
    const enriched = await Promise.all(
      accounts.map(async (account) => {
        const trades = await this.prisma.trade.findMany({
          where: { accountId: account.id, status: 'CLOSED' },
          select: { pnlNet: true },
        });

        const totalTrades = trades.length;
        const wins = trades.filter((t) => Number(t.pnlNet) > 0).length;
        const totalPnl = trades.reduce(
          (sum, t) => sum + (Number(t.pnlNet) || 0),
          0,
        );

        // Calculate drawdown from equity curve
        let peak = Number(account.balance);
        let maxDrawdown = 0;
        let running = peak;
        for (const trade of trades) {
          running += Number(trade.pnlNet) || 0;
          if (running > peak) peak = running;
          const dd = peak > 0 ? ((peak - running) / peak) * 100 : 0;
          if (dd > maxDrawdown) maxDrawdown = dd;
        }

        // Determine online status (within 90 seconds)
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

  /**
   * Get a single account (ownership check).
   */
  async findOne(userId: string, id: string) {
    const account = await this.prisma.tradingAccount.findUnique({
      where: { id },
    });

    if (!account) throw new NotFoundException('Account not found');
    if (account.userId !== userId)
      throw new ForbiddenException('Access denied');

    return account;
  }

  /**
   * Update account name/broker.
   */
  async update(userId: string, id: string, dto: UpdateAccountDto) {
    await this.findOne(userId, id);

    return this.prisma.tradingAccount.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Toggle account active/inactive.
   */
  async toggle(userId: string, id: string) {
    const account = await this.findOne(userId, id);

    return this.prisma.tradingAccount.update({
      where: { id },
      data: { active: !account.active },
    });
  }

  /**
   * Regenerate API key. Returns the new raw key once.
   */
  async regenerateKey(userId: string, id: string) {
    await this.findOne(userId, id);
    const { raw, hash } = this.generateApiKey();

    await this.prisma.tradingAccount.update({
      where: { id },
      data: { apiKeyHash: hash },
    });

    return { apiKey: raw };
  }

  /**
   * Delete an account and cascade trades.
   */
  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    return this.prisma.tradingAccount.delete({
      where: { id },
    });
  }

  /**
   * Get per-account analytics.
   */
  async getStats(userId: string, id: string) {
    await this.findOne(userId, id);

    const trades = await this.prisma.trade.findMany({
      where: { accountId: id, status: 'CLOSED' },
      orderBy: { entryDate: 'asc' },
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

    // Equity curve + drawdown
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
        date: trade.exitDate
          ? trade.exitDate.toISOString().split('T')[0]
          : trade.entryDate.toISOString().split('T')[0],
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

  /**
   * Find account by API key hash (used by MT5 guard).
   */
  async findByApiKeyHash(hash: string) {
    return this.prisma.tradingAccount.findFirst({
      where: { apiKeyHash: hash, active: true },
      include: { user: { select: { id: true, email: true } } },
    });
  }
}
