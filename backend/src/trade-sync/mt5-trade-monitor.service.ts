import {
  Injectable,
  Logger,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  ReplicationEngine,
  MasterTradeEvent,
} from './replication/replication.engine';
import { REDIS_CLIENT } from './redis.provider';
import { TRADE_SYNC_EVENTS } from './trade-sync.events';
import type Redis from 'ioredis';

/**
 * MT5 Trade Monitor – polls the master account's open positions every 1-2s
 * and detects:
 *   • NEW positions  → emits TRADE_OPEN
 *   • CLOSED positions → emits TRADE_CLOSE
 *   • SL/TP changes  → emits SL_MODIFY / TP_MODIFY
 *
 * Detected events are fed straight into the ReplicationEngine which
 * evaluates risk, adjusts lots, and publishes execution commands for slaves.
 */

interface PositionSnapshot {
  ticket: number;
  symbol: string;
  type: number; // 0 = BUY, 1 = SELL
  type_str: string;
  volume: number;
  price_open: number;
  price_current: number;
  profit: number;
  swap: number;
  sl: number;
  tp: number;
  time: number;
  magic: number;
  comment: string;
}

/**
 * Magic number used by TradePro_Sync for system-placed trades.
 * Positions with this magic were placed by the replication engine and
 * must NOT be replicated again (avoids feedback loops).
 */
const TRADEPRO_MAGIC = 123456;

@Injectable()
export class Mt5TradeMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Mt5TradeMonitorService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private readonly mt5BaseUrl: string;
  private readonly mt5InternalApiKey: string;
  private readonly pollIntervalMs: number;
  private readonly masterMt5Login: string | undefined;
  private polling = false;

  /**
   * In-memory map of the last known positions for the master account.
   * Key = ticket number.
   */
  private lastPositions = new Map<number, PositionSnapshot>();
  private initialized = false;

  /** Cached master DB record so we don't need fetchAccountInfo() every poll */
  private cachedMaster: {
    id: string;
    syncGroupId: string;
    accountNumber: string;
  } | null = null;

  /**
   * Cached slave positions — updated from master's live prices every poll
   * and refreshed from MT5 only once at startup + after trade events.
   * Key = slaveId.
   */
  private cachedSlavePositions = new Map<
    string,
    { positions: PositionSnapshot[]; slaveId: string; accountNumber: string }
  >();
  private slaveRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly replicationEngine: ReplicationEngine,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.mt5BaseUrl =
      this.configService.get<string>('MT5_SERVER_URL') ||
      'http://localhost:3001';
    this.mt5InternalApiKey =
      this.configService.get<string>('MT5_INTERNAL_API_KEY') || '';
    this.pollIntervalMs = parseInt(
      this.configService.get<string>('MT5_TRADE_MONITOR_INTERVAL_MS') || '1500',
      10,
    );
    this.masterMt5Login = this.configService.get<string>('MASTER_MT5_LOGIN');
  }

  async onModuleInit() {
    this.logger.log(
      `Starting MT5 trade monitor (interval: ${this.pollIntervalMs}ms)`,
    );

    // Pre-cache the master account record
    await this.resolveMaster();

    this.intervalHandle = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);

    // First poll just initializes the snapshot (don't trigger replications)
    void this.poll();

    // One-time slave position fetch at startup (3s delay for MT5 to stabilize).
    // After this, slave positions are inferred from master prices — no more
    // MT5 account switching.
    setTimeout(() => void this.refreshSlavePositionsOnce(), 3000);
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    if (this.slaveRefreshTimer) {
      clearTimeout(this.slaveRefreshTimer);
      this.slaveRefreshTimer = null;
    }
    this.logger.log('MT5 trade monitor stopped');
  }

  /* ─────────────────────────── Core Poll Loop ─────────────────────────── */

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;

    try {
      const positions = await this.fetchPositions();
      if (positions === null) return; // MT5 unreachable — skip

      // Only track user-placed positions (magic=0).
      // Positions with TRADEPRO_MAGIC were placed by the replication engine
      // (slave trades) and must never be re-replicated.
      const userPositions = positions.filter((p) => p.magic !== TRADEPRO_MAGIC);

      const currentMap = new Map<number, PositionSnapshot>();
      for (const pos of userPositions) {
        currentMap.set(pos.ticket, pos);
      }

      if (!this.initialized) {
        // First poll: just store the snapshot — don't trigger replications
        this.lastPositions = currentMap;
        this.initialized = true;
        this.logger.log(
          `Trade monitor initialized with ${currentMap.size} open position(s)`,
        );
        // Still broadcast positions on init so UI populates immediately
        await this.broadcastPositions(positions, 'master');
        return;
      }

      // Broadcast live positions to frontend on every poll
      await this.broadcastPositions(positions, 'master');

      // Update cached slave positions using master's live prices and broadcast
      await this.broadcastCachedSlavePositions(positions);

      // Detect NEW positions (in current but not in last)
      for (const [ticket, pos] of currentMap) {
        if (!this.lastPositions.has(ticket)) {
          await this.onNewPosition(pos);
        } else {
          // Position existed — check for modifications
          const prev = this.lastPositions.get(ticket)!;
          if (prev.sl !== pos.sl || prev.tp !== pos.tp) {
            await this.onModifiedPosition(prev, pos);
          }
        }
      }

      // Detect CLOSED positions (in last but not in current)
      for (const [ticket, pos] of this.lastPositions) {
        if (!currentMap.has(ticket)) {
          await this.onClosedPosition(pos);
        }
      }

      this.lastPositions = currentMap;
    } catch (err) {
      this.logger.warn(
        `Trade monitor poll error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.polling = false;
    }
  }

  /* ─────────────────────── Event Handlers ─────────────────────── */

  private async onNewPosition(pos: PositionSnapshot) {
    this.logger.log(
      `🔔 NEW TRADE detected: ${pos.type_str} ${pos.symbol} ${pos.volume} lots @ ${pos.price_open} (ticket ${pos.ticket})`,
    );

    const event = await this.buildTradeEvent(pos, 'TRADE_OPEN');
    if (!event) return;

    const results = await this.replicationEngine.processTradeEvent(event);
    this.logger.log(
      `Replication results for ticket ${pos.ticket}: ${results.length} slave(s) — ` +
        results.map((r) => `${r.slaveName}: ${r.status}`).join(', '),
    );

    // After replication, schedule a one-time slave position refresh
    this.scheduleSlaveRefresh();
  }

  private async onClosedPosition(pos: PositionSnapshot) {
    this.logger.log(
      `🔔 TRADE CLOSED: ${pos.type_str} ${pos.symbol} ${pos.volume} lots (ticket ${pos.ticket})`,
    );

    const event = await this.buildTradeEvent(pos, 'TRADE_CLOSE');
    if (!event) return;

    const results = await this.replicationEngine.processTradeEvent(event);
    this.logger.log(
      `Close replication for ticket ${pos.ticket}: ${results.length} slave(s) — ` +
        results.map((r) => `${r.slaveName}: ${r.status}`).join(', '),
    );

    // After replication, schedule a one-time slave position refresh
    this.scheduleSlaveRefresh();
  }

  private async onModifiedPosition(
    prev: PositionSnapshot,
    curr: PositionSnapshot,
  ) {
    const slChanged = prev.sl !== curr.sl;
    const tpChanged = prev.tp !== curr.tp;
    const eventType =
      slChanged && tpChanged
        ? 'TRADE_MODIFY'
        : slChanged
          ? 'SL_MODIFY'
          : 'TP_MODIFY';

    this.logger.log(
      `🔔 POSITION MODIFIED (${eventType}): ticket ${curr.ticket} — ` +
        `SL: ${prev.sl} → ${curr.sl}, TP: ${prev.tp} → ${curr.tp}`,
    );

    const event = await this.buildTradeEvent(
      curr,
      eventType as MasterTradeEvent['eventType'],
    );
    if (!event) return;

    await this.replicationEngine.processTradeEvent(event);

    // After replication, schedule a one-time slave position refresh
    this.scheduleSlaveRefresh();
  }

  /* ──────────────────── Helpers ──────────────────── */

  /** Resolve and cache the master account from env var or MT5 account info */
  private async resolveMaster(): Promise<void> {
    // Try env var first (most reliable — not affected by MT5 terminal state)
    if (this.masterMt5Login) {
      const master = await this.prisma.masterAccount.findFirst({
        where: { accountNumber: this.masterMt5Login },
        select: { id: true, syncGroupId: true, accountNumber: true },
      });
      if (master) {
        this.cachedMaster = master;
        this.logger.log(
          `Resolved master from env: login=${master.accountNumber} syncGroup=${master.syncGroupId}`,
        );
        return;
      }
    }

    // Fallback: query the MT5 terminal for the current login
    const accountData = await this.fetchAccountInfo();
    if (accountData) {
      const loginStr = String(accountData.login);
      const master = await this.prisma.masterAccount.findFirst({
        where: { accountNumber: loginStr },
        select: { id: true, syncGroupId: true, accountNumber: true },
      });
      if (master) {
        this.cachedMaster = master;
        this.logger.log(
          `Resolved master from MT5 terminal: login=${loginStr} syncGroup=${master.syncGroupId}`,
        );
        return;
      }
    }

    this.logger.warn(
      'Could not resolve master account — trade replication disabled',
    );
  }

  private async buildTradeEvent(
    pos: PositionSnapshot,
    eventType: MasterTradeEvent['eventType'],
  ): Promise<MasterTradeEvent | null> {
    if (!this.cachedMaster) {
      await this.resolveMaster();
    }
    const master = this.cachedMaster;
    if (!master) return null;

    return {
      syncGroupId: master.syncGroupId,
      masterId: master.id,
      symbol: pos.symbol,
      direction: pos.type === 0 ? 'BUY' : 'SELL',
      lot: pos.volume,
      price: pos.price_open,
      stopLoss: pos.sl > 0 ? pos.sl : undefined,
      takeProfit: pos.tp > 0 ? pos.tp : undefined,
      ticket: String(pos.ticket),
      eventType,
    };
  }

  /* ──────────────── Positions Broadcast ──────────────── */

  private async broadcastPositions(
    positions: PositionSnapshot[],
    accountType: 'master' | 'slave',
    accountId?: string,
  ): Promise<void> {
    try {
      const master = this.cachedMaster;
      if (!master) return;

      const totalProfit = positions.reduce((sum, p) => sum + p.profit, 0);
      const totalSwap = positions.reduce((sum, p) => sum + p.swap, 0);

      await this.redis
        .publish(
          `trade-sync:group:${master.syncGroupId}`,
          JSON.stringify({
            type: TRADE_SYNC_EVENTS.POSITIONS_UPDATE,
            accountType,
            accountId: accountId ?? master.id,
            login: master.accountNumber,
            positions: positions.map((p) => ({
              ticket: p.ticket,
              symbol: p.symbol,
              type: p.type,
              direction: p.type === 0 ? 'BUY' : 'SELL',
              volume: p.volume,
              priceOpen: p.price_open,
              priceCurrent: p.price_current,
              profit: p.profit,
              swap: p.swap,
              sl: p.sl,
              tp: p.tp,
              time: p.time,
              comment: p.comment,
            })),
            totalProfit,
            totalSwap,
            totalPnL: totalProfit + totalSwap,
            positionCount: positions.length,
            timestamp: Date.now(),
          }),
        )
        .catch(() => {});
    } catch {
      // Silently fail — broadcast is non-critical
    }
  }

  /* ──────────────── Slave Position Management ──────────────── */

  /**
   * Schedule a one-time slave position refresh from MT5.
   * Debounced: multiple trade events within 3s only trigger one refresh.
   */
  private scheduleSlaveRefresh(): void {
    if (this.slaveRefreshTimer) clearTimeout(this.slaveRefreshTimer);
    this.slaveRefreshTimer = setTimeout(() => {
      void this.refreshSlavePositionsOnce();
    }, 3000);
  }

  /**
   * One-time fetch of slave positions from MT5 (causes account switch).
   * Only called at startup and after trade events — NOT periodically.
   */
  private async refreshSlavePositionsOnce(): Promise<void> {
    const master = this.cachedMaster;
    if (!master) return;

    try {
      const slaves = await this.prisma.slaveAccount.findMany({
        where: {
          syncGroupId: master.syncGroupId,
          status: { in: ['ACTIVE'] },
        },
        select: {
          id: true,
          accountNumber: true,
          serverName: true,
          riskConfig: true,
        },
      });

      for (const slave of slaves) {
        const creds = this.getSlaveCredentials(slave);
        if (!creds) continue;

        const positions = await this.fetchSlavePositions(
          creds.login,
          creds.password,
          creds.server,
        );

        if (positions !== null) {
          this.cachedSlavePositions.set(slave.id, {
            positions,
            slaveId: slave.id,
            accountNumber: slave.accountNumber,
          });
          this.logger.log(
            `Slave ${slave.accountNumber}: cached ${positions.length} position(s)`,
          );

          await this.broadcastSlavePositions(
            positions,
            slave.id,
            slave.accountNumber,
            master.syncGroupId,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `refreshSlavePositions error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Update cached slave positions using master's live price data and broadcast.
   * No MT5 account switching — purely computed from master's current prices.
   * Since master and slave trade the same symbols, the current price is identical.
   */
  private async broadcastCachedSlavePositions(
    masterPositions: PositionSnapshot[],
  ): Promise<void> {
    const master = this.cachedMaster;
    if (!master || this.cachedSlavePositions.size === 0) return;

    // Build a price lookup from master positions: symbol+direction → price_current
    const priceMap = new Map<string, number>();
    for (const p of masterPositions) {
      priceMap.set(`${p.symbol}_${p.type}`, p.price_current);
    }

    for (const [, cached] of this.cachedSlavePositions) {
      // Update each cached slave position with master's live price
      for (const pos of cached.positions) {
        const livePrice = priceMap.get(`${pos.symbol}_${pos.type}`);
        if (livePrice !== undefined) {
          pos.price_current = livePrice;
          // Recalculate profit: (current - open) * volume * direction
          // BUY (type=0): profit when price goes up
          // SELL (type=1): profit when price goes down
          const direction = pos.type === 0 ? 1 : -1;
          const priceDiff = (livePrice - pos.price_open) * direction;
          // Approximate using the ratio: profit ≈ priceDiff * volume * contractValue
          // Since we don't know contractValue, scale from original profit if available
          if (pos.profit !== 0 && pos.price_current !== pos.price_open) {
            const origDiff = (pos.price_current - pos.price_open) * direction;
            if (origDiff !== 0) {
              pos.profit = pos.profit * (priceDiff / origDiff);
            }
          }
        }
      }

      await this.broadcastSlavePositions(
        cached.positions,
        cached.slaveId,
        cached.accountNumber,
        master.syncGroupId,
      );
    }
  }

  private getSlaveCredentials(slave: {
    accountNumber: string;
    serverName: string;
    riskConfig: unknown;
  }): { login: number; password: string; server: string } | null {
    // 1. Try riskConfig JSON field
    const rc = slave.riskConfig as Record<string, unknown> | null;
    if (rc?.mt5Login && rc?.mt5Password) {
      return {
        login: Number(rc.mt5Login),
        password: rc.mt5Password as string,
        server: (rc.mt5Server as string) || slave.serverName,
      };
    }

    // 2. Try environment variables (for single-slave setups)
    const envLogin = this.configService.get<string>('SLAVE_MT5_LOGIN');
    const envPassword = this.configService.get<string>('SLAVE_MT5_PASSWORD');
    const envServer = this.configService.get<string>('SLAVE_MT5_SERVER');

    if (envLogin && envPassword && envServer) {
      if (envLogin === slave.accountNumber || !slave.accountNumber) {
        return {
          login: parseInt(envLogin, 10),
          password: envPassword,
          server: envServer,
        };
      }
    }

    return null;
  }

  private async fetchSlavePositions(
    login: number,
    password: string,
    server: string,
  ): Promise<PositionSnapshot[] | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const params = new URLSearchParams({
        login: String(login),
        password,
        server,
      });

      const response = await fetch(
        `${this.mt5BaseUrl}/api/mt5/positions/${login}?${params.toString()}`,
        {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${this.mt5InternalApiKey}`,
          },
        },
      );

      clearTimeout(timeout);
      if (!response.ok) return null;

      const json = (await response.json()) as {
        data?: PositionSnapshot[];
      };
      return json.data ?? [];
    } catch {
      return null;
    }
  }

  private async broadcastSlavePositions(
    positions: PositionSnapshot[],
    slaveId: string,
    slaveAccountNumber: string,
    syncGroupId: string,
  ): Promise<void> {
    try {
      const totalProfit = positions.reduce((sum, p) => sum + p.profit, 0);
      const totalSwap = positions.reduce((sum, p) => sum + p.swap, 0);

      await this.redis
        .publish(
          `trade-sync:group:${syncGroupId}`,
          JSON.stringify({
            type: TRADE_SYNC_EVENTS.POSITIONS_UPDATE,
            accountType: 'slave',
            accountId: slaveId,
            login: slaveAccountNumber,
            positions: positions.map((p) => ({
              ticket: p.ticket,
              symbol: p.symbol,
              type: p.type,
              direction: p.type === 0 ? 'BUY' : 'SELL',
              volume: p.volume,
              priceOpen: p.price_open,
              priceCurrent: p.price_current,
              profit: p.profit,
              swap: p.swap,
              sl: p.sl,
              tp: p.tp,
              time: p.time,
              comment: p.comment,
            })),
            totalProfit,
            totalSwap,
            totalPnL: totalProfit + totalSwap,
            positionCount: positions.length,
            timestamp: Date.now(),
          }),
        )
        .catch(() => {});
    } catch {
      // Silently fail
    }
  }

  /* ──────────────── Position Fetching ──────────────── */

  private async fetchPositions(): Promise<PositionSnapshot[] | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.mt5BaseUrl}/api/mt5/positions`, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.mt5InternalApiKey}`,
        },
      });

      clearTimeout(timeout);
      if (!response.ok) return null;

      const json = (await response.json()) as {
        data?: PositionSnapshot[];
      };
      return json.data ?? [];
    } catch {
      return null;
    }
  }

  private async fetchAccountInfo(): Promise<{
    login: number;
    equity: number;
    balance: number;
  } | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this.mt5BaseUrl}/api/mt5/account`, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.mt5InternalApiKey}`,
        },
      });

      clearTimeout(timeout);
      if (!response.ok) return null;

      const json = (await response.json()) as {
        data?: { login: number; equity: number; balance: number };
      };
      return json.data ?? null;
    } catch {
      return null;
    }
  }
}
