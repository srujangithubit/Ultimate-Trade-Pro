import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RiskEngineService,
  TradeSignal,
  SlaveRiskProfile,
} from './risk-engine.service';
import { REDIS_CLIENT } from '../redis.provider';
import { TRADE_SYNC_EVENTS } from '../trade-sync.events';
import type Redis from 'ioredis';

export interface MasterTradeEvent {
  syncGroupId: string;
  masterId: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  lot: number;
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  ticket: string;
  eventType:
    | 'TRADE_OPEN'
    | 'TRADE_CLOSE'
    | 'TRADE_MODIFY'
    | 'PARTIAL_CLOSE'
    | 'SL_MODIFY'
    | 'TP_MODIFY';
}

export interface ReplicationResult {
  slaveId: string;
  slaveName: string;
  status: 'REPLICATED' | 'SKIPPED' | 'FAILED';
  adjustedLot?: number;
  adjustedDirection?: string;
  reason?: string;
  latencyMs: number;
}

@Injectable()
export class ReplicationEngine {
  private readonly logger = new Logger(ReplicationEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly riskEngine: RiskEngineService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async processTradeEvent(
    event: MasterTradeEvent,
  ): Promise<ReplicationResult[]> {
    const startTime = Date.now();
    const results: ReplicationResult[] = [];

    const slaves = await this.prisma.slaveAccount.findMany({
      where: {
        syncGroupId: event.syncGroupId,
        status: { in: ['ACTIVE'] },
        killSwitchTriggered: false,
      },
    });

    if (slaves.length === 0) {
      this.logger.debug(`No active slaves for sync group ${event.syncGroupId}`);
      return results;
    }

    const signal: TradeSignal = {
      symbol: event.symbol,
      direction: event.direction,
      lot: event.lot,
      price: event.price,
      stopLoss: event.stopLoss,
      takeProfit: event.takeProfit,
    };

    for (const slave of slaves) {
      const slaveStart = Date.now();

      // Extract risk config from JSON field
      const rc = slave.riskConfig as {
        mode?: string;
        lotMultiplier?: number;
        fixedLot?: number;
        riskPercentage?: number;
        equityPercentage?: number;
        maxLotSize?: number;
        minLotSize?: number;
        reverseDirection?: boolean;
        copyStopLoss?: boolean;
        copyTakeProfit?: boolean;
        slippage?: number;
      } | null;

      const profile: SlaveRiskProfile = {
        riskMode: rc?.mode ?? 'LOT_MULTIPLIER',
        lotMultiplier: Number(rc?.lotMultiplier ?? 1),
        fixedLot: rc?.fixedLot ? Number(rc.fixedLot) : null,
        riskPercentage: rc?.riskPercentage ? Number(rc.riskPercentage) : null,
        equityPercentage: rc?.equityPercentage
          ? Number(rc.equityPercentage)
          : null,
        maxLotSize: Number(rc?.maxLotSize ?? 10),
        minLotSize: Number(rc?.minLotSize ?? 0.01),
        reverseDirection: Boolean(rc?.reverseDirection ?? false),
        copyStopLoss: Boolean(rc?.copyStopLoss ?? true),
        copyTakeProfit: Boolean(rc?.copyTakeProfit ?? true),
        slippagePoints: Number(rc?.slippage ?? 5),
        symbolFilters: slave.symbolFilters ?? [],
        equity: parseFloat(slave.equity?.toString() ?? '0'),
        balance: parseFloat(slave.balance?.toString() ?? '0'),
        killSwitchTriggered: slave.killSwitchTriggered,
        status: slave.status,
        currentDailyDrawdownPct: parseFloat(
          slave.currentDailyDrawdownPct?.toString() ?? '0',
        ),
        maxDailyDrawdownPct: parseFloat(
          slave.maxDailyDrawdownPct?.toString() ?? '5',
        ),
      };

      const riskCheck = this.riskEngine.evaluate(signal, profile);
      const latencyMs = Date.now() - slaveStart;

      if (!riskCheck.allowed) {
        results.push({
          slaveId: slave.id,
          slaveName: slave.displayName,
          status: 'SKIPPED',
          reason: riskCheck.reason,
          latencyMs,
        });

        await this.recordEvent(event, slave.id, 'SKIPPED', {
          skipReason: riskCheck.reason,
          latencyMs,
        });

        continue;
      }

      const adjustedDirection = this.riskEngine.adjustDirection(
        event.direction,
        profile.reverseDirection,
      );
      const adjustedSL = this.riskEngine.adjustStopLoss(signal, profile);
      const adjustedTP = this.riskEngine.adjustTakeProfit(signal, profile);

      // Record as PENDING then publish for MT5 execution
      const repEvent = await this.recordEvent(event, slave.id, 'PENDING', {
        adjustedVolume: riskCheck.adjustedLot,
        adjustedDirection,
        adjustedSL,
        adjustedTP,
        latencyMs,
      });

      // Publish to Redis for MT5 gateway to pick up
      await this.redis
        .publish(
          `trade-sync:execute:${slave.id}`,
          JSON.stringify({
            replicationEventId: repEvent.id,
            slaveId: slave.id,
            slaveAccountNumber: slave.accountNumber,
            slaveBroker: slave.brokerName,
            slaveServer: slave.serverName,
            symbol: event.symbol,
            direction: adjustedDirection,
            lot: riskCheck.adjustedLot,
            stopLoss: adjustedSL,
            takeProfit: adjustedTP,
            price: event.price,
            masterTicket: event.ticket,
            eventType: event.eventType,
            slippagePoints: profile.slippagePoints,
          }),
        )
        .catch((err) => this.logger.error('Failed to publish execution', err));

      results.push({
        slaveId: slave.id,
        slaveName: slave.displayName,
        status: 'REPLICATED',
        adjustedLot: riskCheck.adjustedLot,
        adjustedDirection,
        latencyMs,
      });
    }

    // Publish summary to group channel
    const totalLatency = Date.now() - startTime;
    await this.redis
      .publish(
        `trade-sync:group:${event.syncGroupId}`,
        JSON.stringify({
          type: TRADE_SYNC_EVENTS.REPLICATION_RESULT,
          masterTicket: event.ticket,
          symbol: event.symbol,
          direction: event.direction,
          results,
          totalLatencyMs: totalLatency,
        }),
      )
      .catch(() => {});

    return results;
  }

  async confirmExecution(
    replicationEventId: string,
    success: boolean,
    details: {
      slaveTicket?: string;
      errorMessage?: string;
    },
  ): Promise<void> {
    await this.prisma.replicationEvent.update({
      where: { id: replicationEventId },
      data: {
        status: success ? 'SUCCESS' : 'FAILED',
        slaveTicket: details.slaveTicket ?? null,
        errorMessage: details.errorMessage ?? null,
        executedAt: success ? new Date() : null,
      },
    });

    const event = await this.prisma.replicationEvent.findUnique({
      where: { id: replicationEventId },
      include: { slaveAccount: true },
    });

    if (event) {
      // Increment replication counters
      await this.prisma.slaveAccount.update({
        where: { id: event.slaveId },
        data: {
          totalReplicatedTrades: { increment: 1 },
          ...(success
            ? { totalSuccessfulReplications: { increment: 1 } }
            : { totalFailedReplications: { increment: 1 } }),
        },
      });

      await this.redis
        .publish(
          `trade-sync:group:${event.slaveAccount.syncGroupId}`,
          JSON.stringify({
            type: success
              ? TRADE_SYNC_EVENTS.TRADE_EXECUTED
              : TRADE_SYNC_EVENTS.REPLICATION_RESULT,
            replicationEventId,
            slaveId: event.slaveId,
            success,
            ...details,
          }),
        )
        .catch(() => {});
    }
  }

  private async recordEvent(
    event: MasterTradeEvent,
    slaveId: string,
    status: string,
    meta: Record<string, number | string | null | undefined>,
  ) {
    return this.prisma.replicationEvent.create({
      data: {
        syncGroupId: event.syncGroupId,
        masterId: event.masterId,
        slaveId,
        eventType:
          event.eventType as unknown as import('@prisma/client').ReplicationEventType,
        masterSymbol: event.symbol,
        masterSide: event.direction,
        masterVolume: event.lot,
        masterPrice: event.price,
        masterSL: event.stopLoss ?? null,
        masterTP: event.takeProfit ?? null,
        masterTicket: event.ticket,
        adjustedVolume: Number(meta.adjustedVolume ?? event.lot),
        skipReason: (meta.skipReason as string) ?? null,
        status: status as unknown as import('@prisma/client').ReplicationStatus,
        latencyMs: Number(meta.latencyMs ?? 0),
      },
    });
  }
}
