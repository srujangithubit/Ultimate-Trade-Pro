import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReplicationEngine, MasterTradeEvent } from './replication.engine';

@Injectable()
export class ReplicationService {
  private readonly logger = new Logger(ReplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: ReplicationEngine,
  ) {}

  async replicateTrade(event: MasterTradeEvent) {
    return this.engine.processTradeEvent(event);
  }

  async replicateTradeForUser(userId: string, event: MasterTradeEvent) {
    const master = await this.prisma.masterAccount.findFirst({
      where: {
        id: event.masterId,
        syncGroupId: event.syncGroupId,
        userId,
      },
      select: { id: true },
    });

    if (!master) {
      throw new NotFoundException('Master account not found');
    }

    return this.engine.processTradeEvent(event);
  }

  async confirmExecution(
    replicationEventId: string,
    success: boolean,
    details: {
      slaveTicket?: string;
      errorMessage?: string;
    },
  ) {
    return this.engine.confirmExecution(replicationEventId, success, details);
  }

  async confirmExecutionForUser(
    userId: string,
    replicationEventId: string,
    success: boolean,
    details: {
      slaveTicket?: string;
      errorMessage?: string;
    },
  ) {
    const event = await this.prisma.replicationEvent.findFirst({
      where: {
        id: replicationEventId,
        syncGroup: { userId },
      },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException('Replication event not found');
    }

    return this.engine.confirmExecution(replicationEventId, success, details);
  }

  async getReplicationHistory(
    syncGroupId: string,
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
    } = {},
  ) {
    const group = await this.prisma.syncGroup.findFirst({
      where: { id: syncGroupId, userId },
    });

    if (!group) {
      throw new NotFoundException('Sync group not found');
    }

    const { limit = 50, offset = 0, status } = options;

    const where: {
      syncGroupId: string;
      status?: import('@prisma/client').ReplicationStatus;
    } = { syncGroupId };
    if (status) {
      where.status = status as import('@prisma/client').ReplicationStatus;
    }

    const [events, total] = await Promise.all([
      this.prisma.replicationEvent.findMany({
        where,
        orderBy: { initiatedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          slaveAccount: { select: { displayName: true, accountNumber: true } },
        },
      }),
      this.prisma.replicationEvent.count({ where }),
    ]);

    return { events, total, limit, offset };
  }

  async getRecentEvents(syncGroupId: string, count = 20) {
    return this.prisma.replicationEvent.findMany({
      where: { syncGroupId },
      orderBy: { initiatedAt: 'desc' },
      take: count,
      include: {
        slaveAccount: { select: { displayName: true, accountNumber: true } },
      },
    });
  }

  async getReplicationStats(syncGroupId: string) {
    const [total, success, skipped, failed, pending] = await Promise.all([
      this.prisma.replicationEvent.count({
        where: { syncGroupId },
      }),
      this.prisma.replicationEvent.count({
        where: { syncGroupId, status: 'SUCCESS' },
      }),
      this.prisma.replicationEvent.count({
        where: { syncGroupId, status: 'SKIPPED' },
      }),
      this.prisma.replicationEvent.count({
        where: { syncGroupId, status: 'FAILED' },
      }),
      this.prisma.replicationEvent.count({
        where: { syncGroupId, status: 'PENDING' },
      }),
    ]);

    const avgLatency = await this.prisma.replicationEvent.aggregate({
      where: { syncGroupId, status: 'SUCCESS' },
      _avg: { latencyMs: true },
    });

    return {
      total,
      success,
      skipped,
      failed,
      pending,
      successRate: total > 0 ? ((success / total) * 100).toFixed(1) : '0',
      avgLatencyMs: Math.round(avgLatency._avg?.latencyMs ?? 0),
    };
  }
}
