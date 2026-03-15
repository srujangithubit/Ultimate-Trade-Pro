import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getGroupPerformance(syncGroupId: string, userId: string) {
    const group = await this.prisma.syncGroup.findFirst({
      where: { id: syncGroupId, userId },
      include: { masterAccount: true, slaveAccounts: true },
    });

    if (!group) {
      throw new NotFoundException('Sync group not found');
    }

    const master = group.masterAccount;
    const slaves = group.slaveAccounts;

    // Replication stats
    const stats = await this.getReplicationStats(syncGroupId);

    // Equity curves
    const masterEquity = master
      ? await this.getEquityCurve('master', master.id)
      : [];

    const slaveEquities = await Promise.all(
      slaves.map(async (s) => ({
        slaveId: s.id,
        slaveName: s.displayName,
        curve: await this.getEquityCurve('slave', s.id),
      })),
    );

    return {
      syncGroupId,
      groupName: group.name,
      status: group.status,
      master: master
        ? {
            id: master.id,
            displayName: master.displayName,
            accountNumber: master.accountNumber,
            equity: master.equity ? parseFloat(master.equity.toString()) : 0,
            balance: master.balance ? parseFloat(master.balance.toString()) : 0,
            floatingPnL: master.floatingPnL
              ? parseFloat(master.floatingPnL.toString())
              : 0,
            isConnected: master.isConnected,
            lastHeartbeat: master.lastHeartbeat,
          }
        : null,
      slaves: slaves.map((s) => {
        const rc =
          (s.riskConfig as {
            mode?: string;
            lotMultiplier?: number;
          } | null) ?? {};
        return {
          id: s.id,
          displayName: s.displayName,
          accountNumber: s.accountNumber,
          status: s.status,
          equity: s.equity ? parseFloat(s.equity.toString()) : 0,
          balance: s.balance ? parseFloat(s.balance.toString()) : 0,
          floatingPnL: s.floatingPnL ? parseFloat(s.floatingPnL.toString()) : 0,
          isConnected: s.isConnected,
          killSwitchTriggered: s.killSwitchTriggered,
          currentDailyDrawdownPct: s.currentDailyDrawdownPct
            ? parseFloat(s.currentDailyDrawdownPct.toString())
            : 0,
          maxDailyDrawdownPct: s.maxDailyDrawdownPct
            ? parseFloat(s.maxDailyDrawdownPct.toString())
            : 5,
          riskMode: rc.mode ?? 'LOT_MULTIPLIER',
          lotMultiplier: rc.lotMultiplier ? Number(rc.lotMultiplier) : 1,
        };
      }),
      replicationStats: stats,
      masterEquityCurve: masterEquity,
      slaveEquityCurves: slaveEquities,
    };
  }

  async getReplicationStats(syncGroupId: string) {
    const [total, success, skipped, failed] = await Promise.all([
      this.prisma.replicationEvent.count({ where: { syncGroupId } }),
      this.prisma.replicationEvent.count({
        where: { syncGroupId, status: 'SUCCESS' },
      }),
      this.prisma.replicationEvent.count({
        where: { syncGroupId, status: 'SKIPPED' },
      }),
      this.prisma.replicationEvent.count({
        where: { syncGroupId, status: 'FAILED' },
      }),
    ]);

    const avgLatency = await this.prisma.replicationEvent.aggregate({
      where: { syncGroupId, status: 'SUCCESS' },
      _avg: { latencyMs: true },
    });

    return {
      totalTrades: total,
      success,
      skipped,
      failed,
      successRate:
        total > 0 ? parseFloat(((success / total) * 100).toFixed(1)) : 0,
      avgLatencyMs: Math.round(avgLatency._avg?.latencyMs ?? 0),
    };
  }

  private async getEquityCurve(
    type: 'master' | 'slave',
    accountId: string,
    hours = 24,
  ) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    if (type === 'master') {
      const snapshots = await this.prisma.masterEquitySnapshot.findMany({
        where: { masterId: accountId, snapshotAt: { gte: since } },
        orderBy: { snapshotAt: 'asc' },
        select: {
          equity: true,
          balance: true,
          snapshotAt: true,
        },
      });

      return snapshots.map((s) => ({
        equity: parseFloat(s.equity.toString()),
        balance: parseFloat(s.balance.toString()),
        time: s.snapshotAt,
      }));
    }

    const snapshots = await this.prisma.slaveEquitySnapshot.findMany({
      where: { slaveId: accountId, snapshotAt: { gte: since } },
      orderBy: { snapshotAt: 'asc' },
      select: {
        equity: true,
        balance: true,
        snapshotAt: true,
      },
    });

    return snapshots.map((s) => ({
      equity: parseFloat(s.equity.toString()),
      balance: parseFloat(s.balance.toString()),
      time: s.snapshotAt,
    }));
  }
}
