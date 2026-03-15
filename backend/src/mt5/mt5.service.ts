import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HeartbeatDto, Mt5TradeDto } from './dto/mt5.dto';
import { TradingAccount } from '@prisma/client';
import { ObservabilityService } from '../observability/observability.service';

@Injectable()
export class Mt5Service {
  constructor(
    private prisma: PrismaService,
    private readonly observability: ObservabilityService,
  ) {}

  /**
   * Process heartbeat from MT5 EA.
   * Updates account balance, equity, server, login, and lastSeen.
   */
  async processHeartbeat(account: TradingAccount, dto: HeartbeatDto) {
    const updated = await this.prisma.tradingAccount.update({
      where: { id: account.id },
      data: {
        balance: dto.balance,
        equity: dto.equity,
        server: dto.server,
        accountLogin: dto.account_login,
        lastSeen: new Date(),
      },
    });

    this.observability.markMt5Heartbeat(updated.id);

    return {
      status: 'ok',
      accountId: updated.id,
      lastSeen: updated.lastSeen,
    };
  }

  /**
   * Process a closed trade from MT5 EA.
   * Uses (accountId, ticket) unique constraint for idempotency.
   */
  async processTrade(
    account: TradingAccount,
    userId: string,
    dto: Mt5TradeDto,
  ) {
    // Normalize symbol (strip broker suffixes like ".m", ".pro", etc.)
    const symbol = this.normalizeSymbol(dto.symbol);

    // Determine direction
    const direction = dto.side.toUpperCase() === 'BUY' ? 'LONG' : 'SHORT';

    // Calculate net PnL (profit from MT5 is already net of swap/commission in most cases)
    const pnlNet = dto.profit;

    try {
      const trade = await this.prisma.trade.upsert({
        where: {
          accountId_ticket: {
            accountId: account.id,
            ticket: dto.ticket,
          },
        },
        create: {
          userId,
          accountId: account.id,
          symbol,
          direction,
          entryDate: new Date(dto.open_time),
          exitDate: new Date(dto.close_time),
          entryPrice: dto.entry,
          exitPrice: dto.exit,
          quantity: dto.lots,
          stopLoss: dto.sl || null,
          takeProfit: dto.tp || null,
          pnlNet,
          pnlGross: pnlNet,
          status: 'CLOSED',
          ticket: dto.ticket,
          magic: dto.magic || null,
          comment: dto.comment || null,
          source: 'mt5',
        },
        update: {
          // Update if trade was modified (e.g., partial close)
          exitDate: new Date(dto.close_time),
          exitPrice: dto.exit,
          pnlNet,
          pnlGross: pnlNet,
          stopLoss: dto.sl || null,
          takeProfit: dto.tp || null,
          status: 'CLOSED',
        },
      });
      this.observability.markOrderCreated('mt5');

      // Also update account balance/equity with latest values
      await this.prisma.tradingAccount.update({
        where: { id: account.id },
        data: {
          lastSeen: new Date(),
          accountLogin: dto.account_login,
          server: dto.server,
        },
      });

      return {
        status: 'ok',
        tradeId: trade.id,
        ticket: trade.ticket,
        isNew: trade.createdAt.getTime() === trade.updatedAt.getTime(),
      };
    } catch (error: unknown) {
      // Handle unique constraint violation gracefully (shouldn't happen with upsert, but safety net)
      if (
        error instanceof Object &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        this.observability.markOrderRejected('mt5_conflict_duplicate_ticket');
        throw new ConflictException(
          `Trade with ticket ${dto.ticket} already exists for this account`,
        );
      }
      this.observability.markApiError('mt5', 'process_trade_failed');
      throw error;
    }
  }

  /**
   * Normalize MT5 symbol by stripping broker-specific suffixes.
   * e.g., "EURUSDm" → "EURUSD", "EURUSD.pro" → "EURUSD"
   */
  private normalizeSymbol(raw: string): string {
    // Remove common broker suffixes
    let symbol = raw.replace(/\.(pro|raw|ecn|std|micro|mini|m|c|i|e|x)$/i, '');
    // Remove trailing lowercase letter often used as suffix (e.g., "EURUSDm")
    if (symbol.length > 6 && /[a-z]$/.test(symbol)) {
      symbol = symbol.slice(0, -1);
    }
    return symbol.toUpperCase();
  }
}
