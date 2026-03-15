import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto, ExecuteOrderDto } from './dto/backtesting.dto';
import { SaveTradeJournalDto, TradeAnalysisFilterDto } from './dto/trade-analysis.dto';
import { CandleLoaderService } from './replay/candle-loader.service';
import { ReplayEngine } from './replay/replay-engine';
import { REDIS_CLIENT } from '../trade-sync/redis.provider';
import type Redis from 'ioredis';
import {
  ReplaySpeed,
  ReplayState,
  CandleFrame,
} from './types/replay.types';
import { ObservabilityService } from '../observability/observability.service';

@Injectable()
export class BacktestingService implements OnModuleDestroy {
  private readonly logger = new Logger(BacktestingService.name);
  private readonly activeEngines: Map<string, ReplayEngine> = new Map();
  private readonly instanceId = `${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
  private readonly distributedStateTtlSec = (() => {
    const configured = Number(process.env.REPLAY_STATE_TTL ?? '3600');
    if (!Number.isFinite(configured) || configured <= 0) {
      return 3600;
    }
    return configured;
  })();

  private isMissingTradeJournalTable(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const code = (error as { code?: string }).code;
    const table = (error as { meta?: { table?: string } }).meta?.table;
    return code === 'P2021' && typeof table === 'string' && table.includes('trade_journal');
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly candleLoader: CandleLoaderService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly observability: ObservabilityService,
  ) {}

  onModuleDestroy() {
    this.redis.disconnect();
  }

  // ─── CONFIG & NORMALIZATION HELPERS ───────────────────────────────

  private extractConfig(session: { configuration: unknown }): {
    symbol: string;
    resolution: string;
    timezone: string;
    startDate: Date;
    endDate: Date;
    startingBalance: number;
  } {
    const cfg = typeof session.configuration === 'string'
      ? JSON.parse(session.configuration)
      : (session.configuration ?? {}) as Record<string, unknown>;
    return {
      symbol: String(cfg.instrument ?? cfg.symbol ?? '').toUpperCase().trim(),
      resolution: this.normalizeResolution(String(cfg.timeframe ?? cfg.resolution ?? '60')),
      timezone: String(cfg.timezone ?? 'UTC'),
      startDate: new Date(String(cfg.startDate ?? cfg.start_date)),
      endDate: new Date(String(cfg.endDate ?? cfg.end_date)),
      startingBalance: parseFloat(String(cfg.startingBalance ?? cfg.starting_balance ?? 10000)),
    };
  }

  private detectContractSize(symbol: string): number {
    const sym = (symbol || '').toUpperCase();
    if (sym === 'XAUUSD') return 100;
    if (sym === 'XAGUSD') return 5000;
    if (sym.includes('BTC') || sym.includes('XBT')) return 1;
    if (sym.includes('ETH')) return 1;
    if (sym.includes('US30')) return 1;
    if (sym.includes('US500') || sym.includes('SPX')) return 50;
    if (sym.includes('NAS')) return 20;
    return 100_000; // standard forex lot
  }

  private normalizeResolution(tf: string): string {
    const map: Record<string, string> = {
      '1m': '1', '5m': '5', '15m': '15', '30m': '30',
      '1h': '60', '4h': '240', '1d': '1440',
      'M1': '1', 'M5': '5', 'M15': '15', 'M30': '30',
      'H1': '60', 'H4': '240', 'D1': '1440', 'W1': '10080', 'MN1': '43200',
    };
    return map[tf] ?? tf;
  }

  private timeframeToMinutes(timeframe: string): number {
    const map: Record<string, number> = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
      '1': 1,
      '5': 5,
      '15': 15,
      '30': 30,
      '60': 60,
      '240': 240,
      '1440': 1440,
    };
    return map[timeframe] ?? 5;
  }

  private parseCandleNumber(value: unknown, field: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(`Invalid candle ${field} value`);
    }
    return parsed;
  }

  private computeQualityScores(
    trade: {
      pnlNet: number | null;
      entryPrice: number;
      exitPrice: number | null;
      quantity: number;
      direction: string;
    },
    journal?: {
      tradeIdea?: string | null;
      mistakes?: string | null;
      emotion?: string | null;
      lessonsLearned?: string | null;
      executionScore?: number | null;
    } | null,
  ) {
    const pnl = trade.pnlNet ?? 0;
    const profitabilityScore = pnl > 0 ? 85 : pnl < 0 ? 35 : 60;

    const executionScore = journal?.executionScore != null
      ? Math.max(0, Math.min(100, journal.executionScore))
      : (pnl > 0 ? 75 : 55);

    const fields = [
      journal?.tradeIdea,
      journal?.mistakes,
      journal?.emotion,
      journal?.lessonsLearned,
    ];
    const completed = fields.filter((f) => Boolean(f && String(f).trim())).length;
    const journalCompletion = Math.round((completed / 4) * 100);

    const overallRating = Math.round(
      profitabilityScore * 0.4 + executionScore * 0.3 + journalCompletion * 0.3,
    );

    return {
      profitabilityScore,
      executionScore,
      journalCompletion,
      overallRating,
    };
  }

  private getDistributedStateKey(sessionId: string): string {
    return `backtest:state:${sessionId}`;
  }

  private getEngineOwnerKey(sessionId: string): string {
    return `backtest:engine-owner:${sessionId}`;
  }

  private async acquireEngineOwnership(sessionId: string): Promise<void> {
    const ownerKey = this.getEngineOwnerKey(sessionId);
    const existingOwner = await this.redis.get(ownerKey);

    if (existingOwner && existingOwner !== this.instanceId) {
      throw new BadRequestException(
        'Replay engine is active on another backend instance',
      );
    }

    await this.redis.set(
      ownerKey,
      this.instanceId,
      'EX',
      this.distributedStateTtlSec,
    );
  }

  private async releaseEngineOwnership(sessionId: string): Promise<void> {
    const ownerKey = this.getEngineOwnerKey(sessionId);
    const owner = await this.redis.get(ownerKey);
    if (owner === this.instanceId) {
      await this.redis.del(ownerKey);
    }
  }

  private async setDistributedState(
    sessionId: string,
    state: ReplayState,
  ): Promise<void> {
    await this.redis.set(
      this.getDistributedStateKey(sessionId),
      JSON.stringify(state),
      'EX',
      this.distributedStateTtlSec,
    );
  }

  private async getDistributedState(
    sessionId: string,
  ): Promise<ReplayState | null> {
    const payload = await this.redis.get(this.getDistributedStateKey(sessionId));
    if (!payload) {
      return null;
    }

    try {
      return JSON.parse(payload) as ReplayState;
    } catch {
      return null;
    }
  }

  // ─── REPLAY ENGINE CONTROL ───────────────────────────────────────

  async playSession(
    sessionId: string,
    speed: ReplaySpeed,
    emitFn: (event: string, data: unknown) => void,
  ): Promise<void> {
    // Check if engine already exists (reconnect case)
    let engine = this.activeEngines.get(sessionId);

    if (!engine) {
      await this.acquireEngineOwnership(sessionId);

      const session = await this.prisma.backtestingSession.findUnique({
        where: { id: sessionId },
        include: { trades: true },
      });
      if (!session) throw new NotFoundException(`Session ${sessionId} not found`);

      const config = this.extractConfig(session);

      // Compute the effective starting balance by adding realized P&L
      // from trades already closed in previous play sessions.
      const closedTrades = (session.trades || []).filter(t => t.status === 'CLOSED');
      const realizedPnL = closedTrades.reduce(
        (sum, t) => sum + (Number(t.pnlNet) || 0), 0,
      );
      const effectiveBalance = config.startingBalance + realizedPnL;

      // Load candles from DB (cached after first load)
      const candles = await this.candleLoader.loadForSession(
        sessionId,
        config.symbol,
        config.resolution,
        config.startDate,
        config.endDate,
      );

      engine = new ReplayEngine(
        {
          sessionId,
          symbol: config.symbol,
          resolution: config.resolution,
          startingBalance: effectiveBalance,
          startIndex: session.replayIndex ?? 0,
        },
        candles,
      );

      // Re-register any still-OPEN positions so the engine tracks
      // their SL/TP and includes them in update broadcasts.
      const openTrades = (session.trades || []).filter(t => t.status === 'OPEN');
      for (const t of openTrades) {
        engine.addPosition({
          id: t.id,
          side: t.direction === 'long' ? 'buy' : 'sell',
          volume: Number(t.quantity),
          entryPrice: Number(t.entryPrice),
          entryTime: Math.floor(new Date(t.entryDate).getTime() / 1000),
          sl: t.stopLoss != null ? Number(t.stopLoss) : null,
          tp: t.takeProfit != null ? Number(t.takeProfit) : null,
          mae: 0,
          mfe: 0,
          unrealizedPnL: 0,
        });
      }

      engine
        .onUpdate(update => {
          emitFn('backtest:update', update);
          if (update.candle.index % 25 === 0) {
            this.setDistributedState(sessionId, update.state).catch((err) =>
              this.logger.warn(`Failed to persist distributed replay state: ${(err as Error).message}`),
            );
          }
          // Persist replayIndex every 100 ticks
          if (update.candle.index % 100 === 0) {
            this.prisma.backtestingSession.update({
              where: { id: sessionId },
              data: { replayIndex: update.candle.index },
            }).catch(err => this.logger.error(`Failed to persist replayIndex: ${(err as Error).message}`));
          }
          // Close trades in DB when SL/TP is triggered by the engine
          if (update.triggeredSLTP && update.triggeredSLTP.length > 0) {
            for (const trigger of update.triggeredSLTP) {
              this.handleTriggeredSLTP(sessionId, trigger.positionId, trigger.type, trigger.triggerPrice, update.candle.time, emitFn)
                .catch(err => this.logger.error(`SL/TP close failed for ${trigger.positionId}: ${(err as Error).message}`));
            }
          }
        })
        .onComplete(finalState => {
          this.observability.markReplayCompleted(
            sessionId,
            finalState.currentIndex,
          );
          emitFn('backtest:completed', finalState);
          this.setDistributedState(sessionId, finalState).catch(() => {
            /* swallow */
          });
          this.prisma.backtestingSession.update({
            where: { id: sessionId },
            data: { status: 'COMPLETED', replayIndex: finalState.currentIndex },
          }).catch(() => { /* swallow */ });
          this.releaseEngineOwnership(sessionId).catch(() => {
            /* swallow */
          });
          this.candleLoader.evictSession(sessionId);
          this.activeEngines.delete(sessionId);
        })
        .onError(err => {
          this.observability.markReplayFailed(sessionId);
          this.observability.markApiError('backtest', 'replay_engine_error');
          emitFn('backtest:error', { message: err.message });
        });

      this.activeEngines.set(sessionId, engine);
      this.observability.markReplayStarted(sessionId);
    }

    engine.setSpeed(speed);
    // Don't call engine.play() here — let the caller (gateway) emit
    // state_sync first so clients set isPlaying=true before updates flow.
    await this.prisma.backtestingSession.update({
      where: { id: sessionId },
      data: { status: 'RUNNING' },
    });
  }

  /** Start ticking the engine. Call after state_sync to avoid race. */
  startEngine(sessionId: string): void {
    const engine = this.activeEngines.get(sessionId);
    if (engine) engine.play();
  }

  async pauseSession(sessionId: string): Promise<void> {
    const engine = this.activeEngines.get(sessionId);
    if (!engine) return;
    engine.pause();
    const state = engine.getState();
    await this.setDistributedState(sessionId, state);
    await this.prisma.backtestingSession.update({
      where: { id: sessionId },
      data: { status: 'PAUSED', replayIndex: state.currentIndex },
    });
  }

  async seekSession(sessionId: string, targetIndex: number): Promise<void> {
    const engine = this.activeEngines.get(sessionId);
    if (!engine) {
      // No engine yet (user hasn't pressed Play). Persist the index so the
      // engine starts from there when play is eventually pressed.
      this.logger.warn(`Seek ignored – no active engine for session ${sessionId}. Persisting replayIndex=${targetIndex}.`);
      await this.prisma.backtestingSession.update({
        where: { id: sessionId },
        data: { replayIndex: targetIndex },
      });
      return;
    }
    engine.seek(targetIndex);
  }

  async setSessionSpeed(sessionId: string, speed: ReplaySpeed): Promise<void> {
    const engine = this.activeEngines.get(sessionId);
    if (!engine) return;
    engine.setSpeed(speed);
  }

  async getActiveEngineState(sessionId: string): Promise<ReplayState | null> {
    const local = this.activeEngines.get(sessionId)?.getState();
    if (local) {
      return local;
    }

    return this.getDistributedState(sessionId);
  }

  getCandleSliceForChart(sessionId: string, fromIndex: number, toIndex: number): CandleFrame[] {
    return this.activeEngines.get(sessionId)?.getCandleSlice(fromIndex, toIndex) ?? [];
  }

  async destroySession(sessionId: string): Promise<void> {
    const engine = this.activeEngines.get(sessionId);
    if (engine) {
      engine.destroy();
      this.activeEngines.delete(sessionId);
    }

    await this.releaseEngineOwnership(sessionId);
    await this.redis.del(this.getDistributedStateKey(sessionId));

    this.candleLoader.evictSession(sessionId);
  }

  /**
   * Switch the replay engine to a new timeframe/resolution mid-session.
   * Preserves the current replay position by timestamp (not index, since
   * indexes are resolution-specific).
   *
   * Returns the new ReplayState so the gateway can emit a state_sync.
   */
  async changeTimeframe(
    sessionId: string,
    newTimeframe: string,
  ): Promise<{ newIndex: number; resolution: string } | null> {
    const session = await this.prisma.backtestingSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);

    const config = this.extractConfig(session);
    const newResolution = this.normalizeResolution(newTimeframe);

    // If already at this resolution and no engine, nothing to do
    if (newResolution === config.resolution && !this.activeEngines.has(sessionId)) {
      return null;
    }

    // Capture current time from the running/paused engine (if any)
    let currentTime = 0;
    const engine = this.activeEngines.get(sessionId);
    if (engine) {
      const state = engine.getState();
      currentTime = state.currentTime;
      engine.destroy();
      this.activeEngines.delete(sessionId);
    }

    // Evict the old candle cache (resolution changed)
    this.candleLoader.evictSession(sessionId);

    // Load candles at the new resolution
    const newCandles = await this.candleLoader.loadForSession(
      sessionId,
      config.symbol,
      newResolution,
      config.startDate,
      config.endDate,
    );

    // Find the equivalent index by timestamp
    let newIndex = 0;
    if (currentTime > 0 && newCandles.length > 0) {
      // Find the last candle whose time <= currentTime
      for (let i = newCandles.length - 1; i >= 0; i--) {
        if (newCandles[i].time <= currentTime) {
          newIndex = i;
          break;
        }
      }
    }

    // Update session configuration with the new timeframe and the new replay index
    const cfg = typeof session.configuration === 'string'
      ? JSON.parse(session.configuration)
      : (session.configuration ?? {}) as Record<string, unknown>;
    cfg.timeframe = newTimeframe;

    await this.prisma.backtestingSession.update({
      where: { id: sessionId },
      data: {
        replayIndex: newIndex,
        configuration: cfg,
      },
    });

    this.logger.log(
      `changeTimeframe: session ${sessionId} switched to ${newTimeframe} (resolution=${newResolution}). ` +
      `currentTime=${currentTime}, newIndex=${newIndex}/${newCandles.length}`,
    );

    return { newIndex, resolution: newResolution };
  }

  // ─── SESSION CRUD ────────────────────────────────────────────────

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
          timeframe: dto.timeframe ?? '1h',
          timezone: dto.timezone ?? 'UTC',
          startingBalance: dto.startingBalance,
          startDate: dto.startDate,
          endDate: dto.endDate,
        },
      },
    });
  }

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

  async listSessions(userId: string) {
    return this.prisma.backtestingSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { trades: true },
    });
  }

  async executeOrder(userId: string, sessionId: string, dto: ExecuteOrderDto & { sl?: number; tp?: number }) {
    const session = await this.getSession(userId, sessionId);

    if (session.status === 'completed') {
      this.observability.markOrderRejected('session_completed');
      throw new BadRequestException('Cannot execute orders on a completed session');
    }

    const config = session.configuration as Record<string, unknown>;
    const engine = this.activeEngines.get(sessionId);

    // Use current candle price from engine if no explicit price provided
    let entryPrice = dto.price ?? 0;
    if (entryPrice === 0 && engine) {
      const state = engine.getState();
      const candle = engine.getCandleSlice(state.currentIndex, state.currentIndex + 1);
      entryPrice = candle[0]?.close ?? 0;
    }

    if (entryPrice <= 0) {
      this.observability.markOrderRejected('invalid_entry_price');
      throw new BadRequestException('Invalid entry price');
    }

    const sl = dto.sl ?? null;
    const tp = dto.tp ?? null;

    // Use simulation time from engine's current candle, not wall-clock time
    let simEntryDate: Date = new Date();
    if (engine) {
      const state = engine.getState();
      if (state.currentTime > 0) {
        simEntryDate = new Date(state.currentTime * 1000);
      }
    }

    const trade = await this.prisma.trade.create({
      data: {
        userId,
        accountId: session.accountId ?? undefined,
        backtestSessionId: sessionId,
        symbol: String(config.instrument),
        direction: dto.direction,
        entryDate: simEntryDate,
        entryPrice,
        quantity: dto.quantity,
        stopLoss: sl,
        takeProfit: tp,
        status: 'OPEN',
        notes: dto.notes ?? null,
      },
    });
    this.observability.markOrderCreated('backtest');

    // Register with replay engine so it tracks SL/TP and includes
    // the position in real-time update broadcasts
    if (engine) {
      engine.addPosition({
        id: trade.id,
        side: dto.direction === 'long' ? 'buy' : 'sell',
        volume: dto.quantity,
        entryPrice,
        entryTime: Math.floor(new Date(trade.entryDate).getTime() / 1000),
        sl,
        tp,
        mae: 0,
        mfe: 0,
        unrealizedPnL: 0,
      });
    }

    return trade;
  }

  async closeTrade(
    userId: string,
    sessionId: string,
    tradeId: string,
    exitPrice: number,
  ) {
    await this.getSession(userId, sessionId);

    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
    });

    if (!trade || trade.backtestSessionId !== sessionId) {
      this.observability.markOrderRejected('trade_not_found');
      throw new NotFoundException('Trade not found in this session');
    }

    if (trade.status !== 'OPEN') {
      this.observability.markOrderRejected('trade_not_open');
      throw new BadRequestException('Trade is not open');
    }

    // Use engine's current candle price as fallback when exitPrice is 0
    let actualExitPrice = exitPrice;
    const engine = this.activeEngines.get(sessionId);
    if (actualExitPrice === 0 && engine) {
      const state = engine.getState();
      const candle = engine.getCandleSlice(state.currentIndex, state.currentIndex + 1);
      actualExitPrice = candle[0]?.close ?? 0;
    }

    if (actualExitPrice <= 0) {
      this.observability.markOrderRejected('invalid_exit_price');
      throw new BadRequestException('Invalid exit price');
    }

    // Close position in engine so it stops tracking it
    if (engine) {
      engine.closePosition(tradeId, actualExitPrice);
    }

    const entryPrice = Number(trade.entryPrice);
    const quantity = Number(trade.quantity);
    const contractSize = this.detectContractSize(trade.symbol);
    const priceDiff =
      trade.direction === 'long'
        ? actualExitPrice - entryPrice
        : entryPrice - actualExitPrice;
    const pnlGross = priceDiff * contractSize * quantity;

    const fees = Number(trade.fees) || 0;
    const pnlNet = pnlGross - fees;

    // Use simulation time from engine's current candle, not wall-clock time
    let simExitDate: Date = new Date();
    if (engine) {
      const state = engine.getState();
      if (state.currentTime > 0) {
        simExitDate = new Date(state.currentTime * 1000);
      }
    }

    return this.prisma.trade.update({
      where: { id: tradeId },
      data: {
        exitPrice: actualExitPrice,
        exitDate: simExitDate,
        pnlGross,
        pnlNet,
        status: 'CLOSED',
      },
    });
  }

  /**
   * Handle SL/TP triggers from the replay engine.
   * Closes the trade in the DB and emits backtest:trade_closed to clients.
   */
  private async handleTriggeredSLTP(
    sessionId: string,
    tradeId: string,
    triggerType: 'sl' | 'tp',
    triggerPrice: number,
    candleTime: number,
    emitFn: (event: string, data: unknown) => void,
  ): Promise<void> {
    const trade = await this.prisma.trade.findUnique({ where: { id: tradeId } });
    if (!trade || trade.status !== 'OPEN') return;

    const entryPrice = Number(trade.entryPrice);
    const quantity = Number(trade.quantity);
    const contractSize = this.detectContractSize(trade.symbol);
    const priceDiff = trade.direction === 'long'
      ? triggerPrice - entryPrice
      : entryPrice - triggerPrice;
    const pnlGross = priceDiff * contractSize * quantity;
    const fees = Number(trade.fees) || 0;
    const pnlNet = pnlGross - fees;

    const exitDate = candleTime > 0 ? new Date(candleTime * 1000) : new Date();

    const closedTrade = await this.prisma.trade.update({
      where: { id: tradeId },
      data: {
        exitPrice: triggerPrice,
        exitDate,
        pnlGross,
        pnlNet,
        status: 'CLOSED',
        notes: `Auto-closed by ${triggerType.toUpperCase()} at ${triggerPrice}`,
      },
    });

    this.logger.log(`SL/TP ${triggerType.toUpperCase()} triggered for trade ${tradeId}: price=${triggerPrice}, pnl=${pnlNet.toFixed(2)}`);
    emitFn('backtest:trade_closed', { sessionId, trade: closedTrade });
  }

  async updateSessionStatus(userId: string, sessionId: string, status: string) {
    await this.getSession(userId, sessionId);
    return this.prisma.backtestingSession.update({
      where: { id: sessionId },
      data: { status },
    });
  }

  async deleteSession(userId: string, sessionId: string) {
    await this.getSession(userId, sessionId);
    await this.destroySession(sessionId);
    return this.prisma.backtestingSession.delete({
      where: { id: sessionId },
    });
  }

  // ─── CANDLE DATA QUERIES ─────────────────────────────────────────

  async loadCandlesForSession(session: { configuration: unknown }, resolutionOverride?: string) {
    const config = this.extractConfig(session);
    if (resolutionOverride) {
      config.resolution = this.normalizeResolution(resolutionOverride);
    }

    if (!config.symbol || !config.resolution) {
      throw new BadRequestException(
        `Cannot load candles: symbol=${config.symbol}, resolution=${config.resolution}. Check session configuration.`
      );
    }

    this.logger.log(
      `loadCandlesForSession: symbol=${config.symbol} resolution=${config.resolution} ` +
      `from=${config.startDate.toISOString()} to=${config.endDate.toISOString()}`
    );

    const raw: {
      id: string;
      time: Date;
      open: unknown;
      high: unknown;
      low: unknown;
      close: unknown;
      volume: unknown;
    }[] = [];

    const pageSize = 20000;
    let cursorId: string | undefined;

    while (true) {
      const page = await this.prisma.marketDataCandle.findMany({
        where: {
          symbol: config.symbol,
          resolution: config.resolution,
          time: { gte: config.startDate, lte: config.endDate },
        },
        orderBy: [{ time: 'asc' }, { id: 'asc' }],
        take: pageSize,
        ...(cursorId
          ? {
              cursor: { id: cursorId },
              skip: 1,
            }
          : {}),
        select: {
          id: true,
          time: true,
          open: true,
          high: true,
          low: true,
          close: true,
          volume: true,
        },
      });

      if (page.length === 0) {
        break;
      }

      raw.push(...page);

      if (page.length < pageSize) {
        break;
      }

      cursorId = page[page.length - 1].id;
    }

    this.logger.log(`Loaded ${raw.length} candles for ${config.symbol} ${config.resolution}`);

    if (raw.length === 0) {
      const available = await this.prisma.$queryRaw<{ symbol: string; resolution: string; cnt: bigint }[]>`
        SELECT symbol, resolution, COUNT(*) as cnt
        FROM "MarketDataCandle"
        GROUP BY symbol, resolution
        ORDER BY cnt DESC
        LIMIT 20
      `;
      const availStr = JSON.stringify(available, (_k, v) => typeof v === 'bigint' ? v.toString() : v);
      throw new NotFoundException(
        `No market data found for ${config.symbol} ${config.resolution} ` +
        `between ${config.startDate.toISOString()} and ${config.endDate.toISOString()}. ` +
        `Available: ${availStr}`
      );
    }

    return raw.map((c, index) => ({
      time: Math.floor(new Date(c.time).getTime() / 1000),
      open: this.parseCandleNumber(c.open, 'open'),
      high: this.parseCandleNumber(c.high, 'high'),
      low: this.parseCandleNumber(c.low, 'low'),
      close: this.parseCandleNumber(c.close, 'close'),
      volume: this.parseCandleNumber(c.volume, 'volume'),
      index,
    }));
  }

  async loadHistoryBeforeSession(
    session: { configuration: unknown },
    resolutionOverride?: string,
    limit = 500,
  ) {
    const config = this.extractConfig(session);
    if (resolutionOverride) {
      config.resolution = this.normalizeResolution(resolutionOverride);
    }

    if (!config.symbol || !config.resolution) {
      return [];
    }

    const cap = Math.min(Math.max(limit, 50), 5000);

    this.logger.log(
      `loadHistoryBeforeSession: symbol=${config.symbol} res=${config.resolution} ` +
      `before=${config.startDate.toISOString()} limit=${cap}`
    );

    const raw = await this.prisma.marketDataCandle.findMany({
      where: {
        symbol: config.symbol,
        resolution: config.resolution,
        time: { lt: config.startDate },
      },
      orderBy: { time: 'desc' },
      take: cap,
    });

    // Reverse to ascending order
    raw.reverse();

    this.logger.log(`Loaded ${raw.length} history candles before session start`);

    return raw.map((c, index) => ({
      time: Math.floor(new Date(c.time).getTime() / 1000),
      open: parseFloat(c.open.toString()),
      high: parseFloat(c.high.toString()),
      low: parseFloat(c.low.toString()),
      close: parseFloat(c.close.toString()),
      volume: parseFloat(c.volume.toString()),
      index,
    }));
  }

  async debugCandles() {
    const sample = await this.prisma.marketDataCandle.findMany({ take: 5, orderBy: { time: 'desc' } });
    const distinctSymbols = await this.prisma.$queryRaw`SELECT DISTINCT symbol FROM "MarketDataCandle" LIMIT 20`;
    const distinctResolutions = await this.prisma.$queryRaw`SELECT DISTINCT resolution FROM "MarketDataCandle" LIMIT 20`;
    const totalCount = await this.prisma.marketDataCandle.count();
    return {
      totalCount,
      sample: sample.map(c => ({
        time: c.time,
        symbol: c.symbol,
        resolution: c.resolution,
        open: c.open.toString(),
        close: c.close.toString(),
      })),
      distinctSymbols,
      distinctResolutions,
    };
  }

  async validateCandleData(sessionId: string) {
    const session = await this.prisma.backtestingSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');

    const config = this.extractConfig(session);

    const count = await this.prisma.marketDataCandle.count({
      where: {
        symbol: config.symbol,
        resolution: config.resolution,
        time: { gte: config.startDate, lte: config.endDate },
      },
    });

    const first = await this.prisma.marketDataCandle.findFirst({
      where: { symbol: config.symbol, resolution: config.resolution, time: { gte: config.startDate } },
      orderBy: { time: 'asc' },
    });

    const last = await this.prisma.marketDataCandle.findFirst({
      where: { symbol: config.symbol, resolution: config.resolution, time: { lte: config.endDate } },
      orderBy: { time: 'desc' },
    });

    const available = await this.prisma.$queryRaw<{ symbol: string; resolution: string; cnt: bigint }[]>`
      SELECT symbol, resolution, COUNT(*) as cnt
      FROM "MarketDataCandle"
      GROUP BY symbol, resolution
      ORDER BY cnt DESC
      LIMIT 20
    `;

    return {
      queriedSymbol: config.symbol,
      queriedResolution: config.resolution,
      sessionRange: { start: config.startDate, end: config.endDate },
      candleCount: count,
      firstCandle: first ? { time: first.time, open: Number(first.open), close: Number(first.close) } : null,
      lastCandle: last ? { time: last.time, open: Number(last.open), close: Number(last.close) } : null,
      availableCombinations: available.map(a => ({
        symbol: a.symbol,
        resolution: a.resolution,
        count: a.cnt.toString(),
      })),
      issue: count === 0
        ? 'NO DATA: MarketDataCandle has no rows for this symbol/resolution/range. Run: npx ts-node scripts/import-candles.ts'
        : null,
    };
  }

  // ─── TRADE ANALYSIS ──────────────────────────────────────────────

  async getTradeAnalysisTrades(userId: string, query: TradeAnalysisFilterDto) {
    const where: any = {
      userId,
    };

    const scope = query.scope ?? 'all';
    if (scope === 'account') {
      where.status = { equals: 'CLOSED', mode: 'insensitive' };
      where.backtestSessionId = null;
    } else if (scope === 'backtest') {
      where.backtestSessionId = { not: null };
    } else {
      where.OR = [
        { status: { equals: 'CLOSED', mode: 'insensitive' } },
        { backtestSessionId: { not: null } },
      ];
    }

    if (query.strategy && query.strategy.trim()) {
      where.setup = {
        contains: query.strategy.trim(),
        mode: 'insensitive',
      };
    }

    if (query.fromDate || query.toDate) {
      where.entryDate = {};
      if (query.fromDate) where.entryDate.gte = new Date(query.fromDate);
      if (query.toDate) where.entryDate.lte = new Date(query.toDate);
    }

    if (query.outcome === 'winners') {
      where.pnlNet = { gt: 0 };
    } else if (query.outcome === 'losers') {
      where.pnlNet = { lte: 0 };
    }

    const trades = await this.prisma.trade.findMany({
      where,
      orderBy: { entryDate: 'desc' },
      take: 500,
      select: {
        id: true,
        symbol: true,
        direction: true,
        entryPrice: true,
        exitPrice: true,
        entryDate: true,
        exitDate: true,
        quantity: true,
        pnlNet: true,
        setup: true,
        backtestSessionId: true,
        source: true,
        createdAt: true,
      },
    });

    return trades.map((t) => {
      const entry = new Date(t.entryDate).getTime();
      const exit = t.exitDate ? new Date(t.exitDate).getTime() : entry;
      const durationMs = Math.max(0, exit - entry);

      return {
        id: t.id,
        symbol: t.symbol,
        direction: t.direction,
        entryPrice: Number(t.entryPrice),
        exitPrice: t.exitPrice != null ? Number(t.exitPrice) : null,
        entryTime: t.entryDate,
        exitTime: t.exitDate,
        quantity: Number(t.quantity),
        pnl: t.pnlNet != null ? Number(t.pnlNet) : null,
        strategy: t.setup,
        tradeSource: t.backtestSessionId ? 'backtest' : t.source ?? 'manual',
        backtestSessionId: t.backtestSessionId,
        createdAt: t.createdAt,
        durationMs,
      };
    });
  }

  async getTradeJournal(userId: string, tradeId: string) {
    const trade = await this.prisma.trade.findFirst({
      where: { id: tradeId, userId },
      select: { id: true },
    });
    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    try {
      return await this.prisma.tradeJournal.findUnique({
        where: { tradeId },
        select: {
          tradeId: true,
          tradeIdea: true,
          mistakes: true,
          emotion: true,
          lessonsLearned: true,
          executionScore: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (this.isMissingTradeJournalTable(error)) {
        this.logger.warn('trade_journal table missing; returning empty journal. Run migration add_trade_journal.sql.');
        return null;
      }
      throw error;
    }
  }

  async saveTradeJournal(userId: string, tradeId: string, dto: SaveTradeJournalDto) {
    const trade = await this.prisma.trade.findFirst({
      where: { id: tradeId, userId },
      select: { id: true },
    });
    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    try {
      return await this.prisma.tradeJournal.upsert({
        where: { tradeId },
        create: {
          tradeId,
          tradeIdea: dto.tradeIdea ?? null,
          mistakes: dto.mistakes ?? null,
          emotion: dto.emotion ?? null,
          lessonsLearned: dto.lessonsLearned ?? null,
          executionScore: dto.executionScore ?? null,
        },
        update: {
          tradeIdea: dto.tradeIdea ?? null,
          mistakes: dto.mistakes ?? null,
          emotion: dto.emotion ?? null,
          lessonsLearned: dto.lessonsLearned ?? null,
          executionScore: dto.executionScore ?? null,
        },
        select: {
          tradeId: true,
          tradeIdea: true,
          mistakes: true,
          emotion: true,
          lessonsLearned: true,
          executionScore: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (this.isMissingTradeJournalTable(error)) {
        throw new BadRequestException(
          'Trade journal storage is not initialized. Apply migration backend/prisma/migrations/add_trade_journal.sql.',
        );
      }
      throw error;
    }
  }

  async getTradeReplayData(
    userId: string,
    tradeId: string,
    options?: { timeframe?: string; before?: number; after?: number; limit?: number },
  ) {
    const trade = await this.prisma.trade.findFirst({
      where: { id: tradeId, userId },
      select: {
        id: true,
        symbol: true,
        direction: true,
        entryPrice: true,
        exitPrice: true,
        entryDate: true,
        exitDate: true,
        quantity: true,
        pnlNet: true,
        setup: true,
        notes: true,
      },
    });
    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    const requestedTimeframe = options?.timeframe ?? '5m';
    let timeframe = requestedTimeframe;
    const beforeCandles = Math.max(0, Math.min(300, options?.before ?? 100));
    const afterCandles = Math.max(0, Math.min(200, options?.after ?? 50));
    const cap = Math.max(50, Math.min(500, options?.limit ?? 500));

    const tfMinutes = this.timeframeToMinutes(timeframe);
    const entryTime = new Date(trade.entryDate);
    const exitTime = trade.exitDate ? new Date(trade.exitDate) : new Date(trade.entryDate);

    // Some historical rows can have entry/exit swapped; build replay window from
    // chronological bounds so candle queries never end up with from > to.
    const earliestTradeTime = entryTime.getTime() <= exitTime.getTime() ? entryTime : exitTime;
    const latestTradeTime = entryTime.getTime() <= exitTime.getTime() ? exitTime : entryTime;

    const from = new Date(earliestTradeTime.getTime() - beforeCandles * tfMinutes * 60 * 1000);
    const to = new Date(latestTradeTime.getTime() + afterCandles * tfMinutes * 60 * 1000);

    type RawCandle = {
      timestamp: Date;
      open: unknown;
      high: unknown;
      low: unknown;
      close: unknown;
      volume: unknown;
    };

    let rawCandles: RawCandle[] = [];
    try {
      rawCandles = await this.prisma.$queryRaw<RawCandle[]>`
        SELECT timestamp, open, high, low, close, volume
        FROM mt5_candles
        WHERE symbol = ${trade.symbol}
          AND timeframe = ${timeframe}
          AND timestamp BETWEEN ${from} AND ${to}
        ORDER BY timestamp ASC
        LIMIT ${cap}
      `;
    } catch {
      const resolution = this.normalizeResolution(timeframe);
      const fallback = await this.prisma.marketDataCandle.findMany({
        where: {
          symbol: { equals: trade.symbol, mode: 'insensitive' },
          resolution,
          time: { gte: from, lte: to },
        },
        orderBy: { time: 'asc' },
        take: cap,
      });
      rawCandles = fallback.map((c) => ({
        timestamp: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));
    }

    if (rawCandles.length === 0) {
      const earliestLookup = new Date(earliestTradeTime.getTime() - 14 * 24 * 60 * 60 * 1000);
      const latestLookup = new Date(latestTradeTime.getTime() + 14 * 24 * 60 * 60 * 1000);
      const candidateResolutions = Array.from(new Set([
        this.normalizeResolution(requestedTimeframe),
        '5',
        '1',
        '15',
        '30',
        '60',
        '240',
        '1440',
      ]));

      for (const resolution of candidateResolutions) {
        const rows = await this.prisma.marketDataCandle.findMany({
          where: {
            symbol: { equals: trade.symbol, mode: 'insensitive' },
            resolution,
            time: { gte: earliestLookup, lte: latestLookup },
          },
          orderBy: { time: 'asc' },
          take: cap,
        });

        if (rows.length > 0) {
          rawCandles = rows.map((c) => ({
            timestamp: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          }));
          timeframe = resolution;
          this.logger.warn(
            `Replay candles fallback used for trade ${tradeId}: timeframe ${requestedTimeframe} -> resolution ${resolution}`,
          );
          break;
        }
      }
    }

    const candles = rawCandles.map((c, index) => ({
      time: Math.floor(new Date(c.timestamp).getTime() / 1000),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Number(c.volume ?? 0),
      index,
    }));

    const replayEntryTime = entryTime.getTime() <= exitTime.getTime() ? entryTime : exitTime;
    const replayExitTime = entryTime.getTime() <= exitTime.getTime() ? exitTime : entryTime;
    const entryTs = Math.floor(replayEntryTime.getTime() / 1000);
    const exitTs = Math.floor(replayExitTime.getTime() / 1000);

    const findNearestCandleIndex = (targetTs: number): number => {
      if (candles.length === 0) return 0;
      let bestIndex = 0;
      let bestDelta = Math.abs(candles[0].time - targetTs);
      for (let i = 1; i < candles.length; i += 1) {
        const delta = Math.abs(candles[i].time - targetTs);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestIndex = i;
        }
      }
      return bestIndex;
    };

    const entryIndex = findNearestCandleIndex(entryTs);
    const exitIndex = findNearestCandleIndex(exitTs);

    let journal: {
      tradeIdea: string | null;
      mistakes: string | null;
      emotion: string | null;
      lessonsLearned: string | null;
      executionScore: number | null;
      updatedAt: Date;
    } | null = null;

    try {
      journal = await this.prisma.tradeJournal.findUnique({
        where: { tradeId },
        select: {
          tradeIdea: true,
          mistakes: true,
          emotion: true,
          lessonsLearned: true,
          executionScore: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (this.isMissingTradeJournalTable(error)) {
        this.logger.warn('trade_journal table missing; replay will continue without journal data.');
        journal = null;
      } else {
        throw error;
      }
    }

    const quality = this.computeQualityScores(
      {
        pnlNet: trade.pnlNet != null ? Number(trade.pnlNet) : null,
        entryPrice: Number(trade.entryPrice),
        exitPrice: trade.exitPrice != null ? Number(trade.exitPrice) : null,
        quantity: Number(trade.quantity),
        direction: trade.direction,
      },
      journal,
    );

    return {
      trade: {
        id: trade.id,
        symbol: trade.symbol,
        direction: trade.direction,
        entryPrice: Number(trade.entryPrice),
        exitPrice: trade.exitPrice != null ? Number(trade.exitPrice) : null,
        entryTime: trade.entryDate,
        exitTime: trade.exitDate,
        quantity: Number(trade.quantity),
        pnl: trade.pnlNet != null ? Number(trade.pnlNet) : null,
        strategy: trade.setup,
        notes: trade.notes,
      },
      candles,
      timeframe,
      entryIndex,
      exitIndex,
      journal,
      quality,
    };
  }

  // ─── SESSION REPORT ───────────────────────────────────────────────

  async getSessionReport(userId: string, sessionId: string) {
    const session = await this.getSession(userId, sessionId);
    const config = this.extractConfig(session);
    const trades = (session.trades || []).filter((t) => t.status === 'CLOSED');

    if (trades.length === 0) {
      return this.buildEmptyReport(sessionId, config);
    }

    const totalTrades = trades.length;
    let winningTrades = 0;
    let losingTrades = 0;
    let breakEvenTrades = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;
    let largestWin = 0;
    let largestLoss = 0;
    let totalHoldingMs = 0;
    let totalCommission = 0;

    const pnlArray: number[] = [];
    const exitDates: (Date | null)[] = [];
    const longStats = { total: 0, wins: 0, losses: 0, pnl: 0 };
    const shortStats = { total: 0, wins: 0, losses: 0, pnl: 0 };
    const monthlyMap = new Map<string, number>();
    const monthlyTradesMap = new Map<string, number>();

    for (const t of trades) {
      const net = Number(t.pnlNet || 0);
      const comm = Number(t.fees || 0);
      pnlArray.push(net);
      exitDates.push(t.exitDate ? new Date(t.exitDate) : null);
      totalCommission += comm;

      const dir = (t.direction || '').toUpperCase();
      const bucket = dir === 'LONG' || dir === 'BUY' ? longStats : shortStats;
      bucket.total++;
      bucket.pnl += net;
      if (net > 0) bucket.wins++;
      else if (net < 0) bucket.losses++;

      if (t.exitDate && t.entryDate) {
        totalHoldingMs += new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime();
      }

      const monthKey = t.exitDate ? new Date(t.exitDate).toISOString().slice(0, 7) : 'unknown';
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + net);
      monthlyTradesMap.set(monthKey, (monthlyTradesMap.get(monthKey) || 0) + 1);

      if (net > 0) {
        winningTrades++;
        grossProfit += net;
        largestWin = Math.max(largestWin, net);
        currentWins++;
        currentLosses = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
      } else if (net < 0) {
        losingTrades++;
        grossLoss += Math.abs(net);
        largestLoss = Math.min(largestLoss, net);
        currentLosses++;
        currentWins = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
      } else {
        breakEvenTrades++;
        currentWins = 0;
        currentLosses = 0;
      }
    }

    const initialBalance = config.startingBalance;
    const netPnL = grossProfit - grossLoss;
    const finalBalance = initialBalance + netPnL;
    const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;
    const lossRate = totalTrades > 0 ? losingTrades / totalTrades : 0;
    const returnPct = initialBalance > 0 ? (netPnL / initialBalance) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;
    const avgWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;
    const expectancy = (winRate * avgWin) - (lossRate * avgLoss);
    const avgHoldingPeriodSeconds = totalTrades > 0 ? totalHoldingMs / totalTrades / 1000 : 0;

    let equity = initialBalance;
    let eqPeak = initialBalance;
    const equityCurve = pnlArray.map((pnl, i) => {
      equity += pnl;
      if (equity > eqPeak) eqPeak = equity;
      const dd = eqPeak > 0 ? ((eqPeak - equity) / eqPeak) * 100 : 0;
      const ddAbs = eqPeak - equity;
      return {
        time: exitDates[i] ? exitDates[i]!.toISOString() : new Date().toISOString(),
        equity: Number(equity.toFixed(2)),
        balance: Number(equity.toFixed(2)),
        drawdown: Number(dd.toFixed(2)),
        drawdownAbs: Number(ddAbs.toFixed(2)),
        tradeCount: i + 1,
      };
    });

    let peak = initialBalance;
    let maxDd = 0;
    let maxDdAbs = 0;
    equity = initialBalance;
    for (const pnl of pnlArray) {
      equity += pnl;
      if (equity > peak) peak = equity;
      const dd = (peak - equity) / peak;
      const ddAbs = peak - equity;
      if (dd > maxDd) maxDd = dd;
      if (ddAbs > maxDdAbs) maxDdAbs = ddAbs;
    }

    const meanReturn = pnlArray.reduce((s, v) => s + v, 0) / pnlArray.length;
    const variance = pnlArray.reduce((s, v) => s + (v - meanReturn) ** 2, 0) / pnlArray.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;

    const downsideVariance = pnlArray.reduce((s, v) => s + (v < 0 ? (v - meanReturn) ** 2 : 0), 0) / pnlArray.length;
    const downsideStdDev = Math.sqrt(downsideVariance);
    const sortinoRatio = downsideStdDev > 0 ? (meanReturn / downsideStdDev) * Math.sqrt(252) : 0;

    const calmarRatio = maxDd > 0 ? (returnPct / 100) / maxDd : 0;
    const recoveryFactor = maxDdAbs > 0 ? netPnL / maxDdAbs : 0;

    const buildDirStats = (s: typeof longStats) => ({
      total: s.total,
      wins: s.wins,
      losses: s.losses,
      winRate: s.total > 0 ? Number((s.wins / s.total).toFixed(4)) : 0,
      avgPnL: s.total > 0 ? Number((s.pnl / s.total).toFixed(2)) : 0,
      totalPnL: Number(s.pnl.toFixed(2)),
    });

    return {
      sessionId,
      instrument: config.symbol,
      timeframe: config.resolution,
      resolution: config.resolution,
      startDate: config.startDate.toISOString(),
      endDate: config.endDate.toISOString(),
      startingBalance: initialBalance,
      finalBalance: Number(finalBalance.toFixed(2)),
      netPnL: Number(netPnL.toFixed(2)),
      grossPnL: Number((grossProfit - grossLoss).toFixed(2)),
      totalCommission: Number(totalCommission.toFixed(2)),
      returnPct: Number(returnPct.toFixed(2)),
      totalTrades,
      winningTrades,
      losingTrades,
      breakEvenTrades,
      winRate: Number(winRate.toFixed(4)),
      lossRate: Number(lossRate.toFixed(4)),
      avgWin: Number(avgWin.toFixed(2)),
      avgLoss: Number(avgLoss.toFixed(2)),
      largestWin: Number(largestWin.toFixed(2)),
      largestLoss: Number(largestLoss.toFixed(2)),
      avgHoldingPeriodSeconds: Number(avgHoldingPeriodSeconds.toFixed(1)),
      maxConsecutiveWins,
      maxConsecutiveLosses,
      profitFactor: profitFactor ? Number(profitFactor.toFixed(2)) : 0,
      expectancy: Number(expectancy.toFixed(2)),
      sharpeRatio: Number(sharpeRatio.toFixed(3)),
      sortinoRatio: Number(sortinoRatio.toFixed(3)),
      maxDrawdown: Number((maxDd * 100).toFixed(2)),
      maxDrawdownAbs: Number(maxDdAbs.toFixed(2)),
      maxDrawdownDuration: 0,
      calmarRatio: Number(calmarRatio.toFixed(3)),
      recoveryFactor: Number(recoveryFactor.toFixed(3)),
      payoffRatio: avgLoss > 0 ? Number((avgWin / avgLoss).toFixed(2)) : 0,
      equityCurve,
      monthlyReturns: Array.from(monthlyMap.entries()).map(([month, pnl]) => ({
        month,
        return: initialBalance > 0 ? Number(((pnl / initialBalance) * 100).toFixed(2)) : 0,
        trades: monthlyTradesMap.get(month) || 0,
        pnl: Number(pnl.toFixed(2)),
      })),
      tradeDistribution: this.buildPnLDistribution(pnlArray),
      longTrades: buildDirStats(longStats),
      shortTrades: buildDirStats(shortStats),
    };
  }

  private buildEmptyReport(
    sessionId: string,
    config: ReturnType<BacktestingService['extractConfig']>,
  ) {
    return {
      sessionId,
      instrument: config.symbol,
      timeframe: config.resolution,
      resolution: config.resolution,
      startDate: config.startDate.toISOString(),
      endDate: config.endDate.toISOString(),
      startingBalance: config.startingBalance,
      finalBalance: config.startingBalance,
      netPnL: 0, grossPnL: 0, totalCommission: 0, returnPct: 0,
      totalTrades: 0, winningTrades: 0, losingTrades: 0, breakEvenTrades: 0,
      winRate: 0, lossRate: 0, avgWin: 0, avgLoss: 0, largestWin: 0, largestLoss: 0,
      avgHoldingPeriodSeconds: 0, maxConsecutiveWins: 0, maxConsecutiveLosses: 0,
      profitFactor: 0, expectancy: 0, sharpeRatio: 0, sortinoRatio: 0,
      maxDrawdown: 0, maxDrawdownAbs: 0, maxDrawdownDuration: 0,
      calmarRatio: 0, recoveryFactor: 0, payoffRatio: 0,
      equityCurve: [], monthlyReturns: [], tradeDistribution: [],
      longTrades: { total: 0, wins: 0, losses: 0, winRate: 0, avgPnL: 0, totalPnL: 0 },
      shortTrades: { total: 0, wins: 0, losses: 0, winRate: 0, avgPnL: 0, totalPnL: 0 },
    };
  }

  // ─── CHART DRAWINGS ─────────────────────────────────────────────

  async getDrawings(userId: string, sessionId: string) {
    // Verify ownership
    await this.getSession(userId, sessionId);
    const rows = await this.prisma.chartDrawing.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(r => ({ ...r.data as Record<string, unknown>, _dbId: r.id }));
  }

  async saveDrawings(userId: string, sessionId: string, drawings: Record<string, unknown>[]) {
    // Verify ownership
    await this.getSession(userId, sessionId);

    // Delete existing drawings for this session and replace with new ones
    await this.prisma.chartDrawing.deleteMany({ where: { sessionId } });

    if (drawings.length === 0) return [];

    const created = await this.prisma.$transaction(
      drawings.map(d => {
        const type = String(d.type || 'unknown');
        return this.prisma.chartDrawing.create({
          data: {
            sessionId,
            type,
            data: d as any,
          },
        });
      }),
    );
    return created.map(r => ({ ...r.data as Record<string, unknown>, _dbId: r.id }));
  }

  private buildPnLDistribution(pnlArray: number[]): { label: string; count: number; percentage: number }[] {
    if (pnlArray.length === 0) return [];
    const min = Math.min(...pnlArray);
    const max = Math.max(...pnlArray);
    const bucketSize = Math.max(Math.ceil((max - min) / 10), 1);
    const bucketStart = Math.floor(min / bucketSize) * bucketSize;
    const buckets = new Map<string, number>();
    for (const pnl of pnlArray) {
      const lower = Math.floor(pnl / bucketSize) * bucketSize;
      const upper = lower + bucketSize;
      const label = `$${lower} to $${upper}`;
      buckets.set(label, (buckets.get(label) || 0) + 1);
    }
    // Sort bucket labels by their numeric lower bound
    const sorted = Array.from(buckets.entries()).sort((a, b) => {
      const aVal = parseInt(a[0].replace('$', ''));
      const bVal = parseInt(b[0].replace('$', ''));
      return aVal - bVal;
    });
    return sorted.map(([label, count]) => ({
      label,
      count,
      percentage: Number(((count / pnlArray.length) * 100).toFixed(1)),
    }));
  }
}
