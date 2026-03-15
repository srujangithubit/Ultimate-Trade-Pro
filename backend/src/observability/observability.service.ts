import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../trade-sync/redis.provider';
import type Redis from 'ioredis';
import {
  apiErrorsTotal,
  backtestFailuresTotal,
  backtestJobDurationSeconds,
  backtestJobsTotal,
  databaseHealthUp,
  databaseQueryDurationSeconds,
  financialInvariantFailuresTotal,
  financialInvariantInvalidTradePriceTotal,
  financialInvariantLastCheckTimestampSeconds,
  financialInvariantLotPrecisionViolationTotal,
  financialInvariantPnlMismatchTotal,
  financialInvariantRiskViolationTotal,
  financialInvariantStatus,
  financialInvariantTimestampViolationTotal,
  mt5BridgeConnectivity,
  mt5HeartbeatsTotal,
  ordersCreatedTotal,
  ordersRejectedTotal,
  rateLimitViolationsTotal,
  redisHealthUp,
  redisRoundtripSeconds,
  replayCandlesProcessed,
  replayDeterminismFailuresTotal,
  replayDeterminismLastCheckTimestampSeconds,
  replayDeterminismStatus,
  replayDurationSeconds,
  replayFailuresTotal,
  replayRunsTotal,
  riskEngineCalculationsTotal,
} from './metrics';

const MT5_HEARTBEAT_STALE_MS = 60_000;
const REPLAY_DETERMINISM_REDIS_KEY = 'observability:replay_determinism:last';
const FINANCIAL_INVARIANT_REDIS_KEY = 'observability:financial_invariant:last';

interface ReplayDeterminismSnapshot {
  deterministic: boolean;
  checkedAt: string;
  datasetHash: string;
  tradeSequenceHash?: string;
  pnlRun1?: number;
  pnlRun2?: number;
}

interface FinancialInvariantSnapshot {
  healthy: boolean;
  checkedAt: string;
  invalidTradePrice: number;
  pnlMismatch: number;
  lotPrecisionViolation: number;
  timestampViolation: number;
  riskViolation: number;
}

@Injectable()
export class ObservabilityService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ObservabilityService.name);
  private readonly replayStarts = new Map<string, number>();
  private readonly mt5LastHeartbeatByAccount = new Map<string, number>();
  private healthTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  onModuleInit(): void {
    void this.restoreReplayDeterminismSnapshot();
    void this.restoreFinancialInvariantSnapshot();
    this.startBackgroundHealthChecks();
  }

  onModuleDestroy(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  markReplayStarted(sessionId: string): void {
    replayRunsTotal.inc();
    backtestJobsTotal.inc();
    this.replayStarts.set(sessionId, Date.now());
  }

  markReplayCompleted(sessionId: string, currentIndex: number): void {
    const startedAt = this.replayStarts.get(sessionId);
    if (!startedAt) {
      return;
    }

    const durationSeconds = (Date.now() - startedAt) / 1000;
    replayDurationSeconds.observe({ result: 'success' }, durationSeconds);
    backtestJobDurationSeconds.observe({ result: 'success' }, durationSeconds);

    if (Number.isFinite(currentIndex) && currentIndex > 0) {
      replayCandlesProcessed.inc(currentIndex);
    }

    this.replayStarts.delete(sessionId);
  }

  markReplayFailed(sessionId: string): void {
    replayFailuresTotal.inc();
    backtestFailuresTotal.inc();

    const startedAt = this.replayStarts.get(sessionId);
    if (!startedAt) {
      return;
    }

    const durationSeconds = (Date.now() - startedAt) / 1000;
    replayDurationSeconds.observe({ result: 'failure' }, durationSeconds);
    backtestJobDurationSeconds.observe({ result: 'failure' }, durationSeconds);
    this.replayStarts.delete(sessionId);
  }

  markOrderCreated(source: 'backtest' | 'mt5' | 'live'): void {
    ordersCreatedTotal.inc({ source });
    riskEngineCalculationsTotal.inc();
  }

  markOrderRejected(reason: string): void {
    ordersRejectedTotal.inc({ reason: this.sanitizeLabel(reason) });
    apiErrorsTotal.inc({ source: 'backtest', type: 'order_rejected' });
  }

  markRateLimitViolation(channel: 'ws' | 'rest', eventName: string): void {
    rateLimitViolationsTotal.inc({
      channel,
      event: this.sanitizeLabel(eventName),
    });
    apiErrorsTotal.inc({ source: channel, type: 'rate_limit' });
  }

  markApiError(source: 'ws' | 'rest' | 'backtest' | 'mt5', type: string): void {
    apiErrorsTotal.inc({ source, type: this.sanitizeLabel(type) });
  }

  markMt5Heartbeat(accountId: string): void {
    const now = Date.now();
    this.mt5LastHeartbeatByAccount.set(accountId, now);
    mt5HeartbeatsTotal.inc();
    mt5BridgeConnectivity.set({ account_id: accountId }, 1);
  }

  async recordReplayDeterminismResult(
    snapshot: ReplayDeterminismSnapshot,
  ): Promise<void> {
    replayDeterminismStatus.set(snapshot.deterministic ? 1 : 0);
    replayDeterminismLastCheckTimestampSeconds.set(
      Math.floor(new Date(snapshot.checkedAt).getTime() / 1000),
    );

    if (!snapshot.deterministic) {
      replayDeterminismFailuresTotal.inc();
      this.markApiError('backtest', 'replay_determinism_failure');
    }

    await this.redis.set(
      REPLAY_DETERMINISM_REDIS_KEY,
      JSON.stringify(snapshot),
    );
  }

  async recordFinancialInvariantResult(
    snapshot: FinancialInvariantSnapshot,
  ): Promise<void> {
    financialInvariantStatus.set(snapshot.healthy ? 1 : 0);
    financialInvariantLastCheckTimestampSeconds.set(
      Math.floor(new Date(snapshot.checkedAt).getTime() / 1000),
    );

    financialInvariantInvalidTradePriceTotal.set(snapshot.invalidTradePrice);
    financialInvariantPnlMismatchTotal.set(snapshot.pnlMismatch);
    financialInvariantLotPrecisionViolationTotal.set(snapshot.lotPrecisionViolation);
    financialInvariantTimestampViolationTotal.set(snapshot.timestampViolation);
    financialInvariantRiskViolationTotal.set(snapshot.riskViolation);

    if (!snapshot.healthy) {
      financialInvariantFailuresTotal.inc();
      this.markApiError('backtest', 'financial_invariant_violation');
    }

    await this.redis.set(
      FINANCIAL_INVARIANT_REDIS_KEY,
      JSON.stringify(snapshot),
    );
  }

  private sanitizeLabel(input: string): string {
    return (input || 'unknown').replace(/[^a-zA-Z0-9_:-]/g, '_').slice(0, 64);
  }

  private startBackgroundHealthChecks(): void {
    this.healthTimer = setInterval(() => {
      void this.sampleRedisHealth();
      void this.sampleDatabaseHealth();
      this.updateMt5ConnectivityGauge();
    }, 15_000);

    this.healthTimer.unref();
  }

  private async restoreReplayDeterminismSnapshot(): Promise<void> {
    try {
      const raw = await this.redis.get(REPLAY_DETERMINISM_REDIS_KEY);
      if (!raw) {
        return;
      }

      const snapshot = JSON.parse(raw) as ReplayDeterminismSnapshot;
      replayDeterminismStatus.set(snapshot.deterministic ? 1 : 0);
      replayDeterminismLastCheckTimestampSeconds.set(
        Math.floor(new Date(snapshot.checkedAt).getTime() / 1000),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to restore replay determinism snapshot: ${(error as Error).message}`,
      );
    }
  }

  private async restoreFinancialInvariantSnapshot(): Promise<void> {
    try {
      const raw = await this.redis.get(FINANCIAL_INVARIANT_REDIS_KEY);
      if (!raw) {
        return;
      }

      const snapshot = JSON.parse(raw) as FinancialInvariantSnapshot;
      financialInvariantStatus.set(snapshot.healthy ? 1 : 0);
      financialInvariantLastCheckTimestampSeconds.set(
        Math.floor(new Date(snapshot.checkedAt).getTime() / 1000),
      );

      financialInvariantInvalidTradePriceTotal.set(snapshot.invalidTradePrice);
      financialInvariantPnlMismatchTotal.set(snapshot.pnlMismatch);
      financialInvariantLotPrecisionViolationTotal.set(snapshot.lotPrecisionViolation);
      financialInvariantTimestampViolationTotal.set(snapshot.timestampViolation);
      financialInvariantRiskViolationTotal.set(snapshot.riskViolation);
    } catch (error) {
      this.logger.warn(
        `Failed to restore financial invariant snapshot: ${(error as Error).message}`,
      );
    }
  }

  private async sampleRedisHealth(): Promise<void> {
    const start = process.hrtime.bigint();
    try {
      await this.redis.ping();
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1_000_000_000;
      redisRoundtripSeconds.observe(durationSeconds);
      redisHealthUp.set(1);
    } catch (error) {
      redisHealthUp.set(0);
      this.logger.warn(`Redis health check failed: ${(error as Error).message}`);
      apiErrorsTotal.inc({ source: 'rest', type: 'redis_health_check_failed' });
    }
  }

  private async sampleDatabaseHealth(): Promise<void> {
    const start = process.hrtime.bigint();
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1_000_000_000;
      databaseQueryDurationSeconds.observe({ query: 'health_check' }, durationSeconds);
      databaseHealthUp.set(1);
    } catch (error) {
      databaseHealthUp.set(0);
      this.logger.warn(`Database health check failed: ${(error as Error).message}`);
      apiErrorsTotal.inc({ source: 'rest', type: 'database_health_check_failed' });
    }
  }

  private updateMt5ConnectivityGauge(): void {
    const now = Date.now();
    for (const [accountId, lastHeartbeat] of this.mt5LastHeartbeatByAccount) {
      const isHealthy = now - lastHeartbeat <= MT5_HEARTBEAT_STALE_MS;
      mt5BridgeConnectivity.set({ account_id: accountId }, isHealthy ? 1 : 0);
    }
  }
}
