import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterSlaveDto } from './dto/register-slave.dto';
import { REDIS_CLIENT } from '../redis.provider';
import { TRADE_SYNC_EVENTS } from '../trade-sync.events';
import type Redis from 'ioredis';

@Injectable()
export class SlaveService {
  private readonly logger = new Logger(SlaveService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async registerSlave(userId: string, dto: RegisterSlaveDto) {
    const group = await this.prisma.syncGroup.findFirst({
      where: { id: dto.syncGroupId, userId },
    });

    if (!group) {
      throw new NotFoundException('Sync group not found');
    }

    const existing = await this.prisma.slaveAccount.findFirst({
      where: {
        syncGroupId: dto.syncGroupId,
        accountNumber: dto.accountNumber,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'This account is already registered in this sync group',
      );
    }

    const riskConfig = {
      mode: dto.riskConfig.mode,
      lotMultiplier: dto.riskConfig.lotMultiplier ?? 1.0,
      fixedLot: dto.riskConfig.fixedLot ?? null,
      riskPercentage: dto.riskConfig.riskPercentage ?? null,
      equityPercentage: dto.riskConfig.equityPercentage ?? null,
      maxLotSize: dto.riskConfig.maxLotSize ?? 10.0,
      minLotSize: dto.riskConfig.minLotSize ?? 0.01,
      reverseDirection: dto.riskConfig.reverseDirection ?? false,
      copyStopLoss: dto.riskConfig.copyStopLoss ?? true,
      copyTakeProfit: dto.riskConfig.copyTakeProfit ?? true,
      slippage: dto.riskConfig.slippage ?? 5,
    };

    const slave = await this.prisma.slaveAccount.create({
      data: {
        syncGroupId: dto.syncGroupId,
        userId,
        accountNumber: dto.accountNumber,
        brokerName: dto.brokerName,
        serverName: dto.serverName,
        displayName: dto.displayName,
        riskConfig,
        symbolFilters: dto.symbolFilters ?? [],
        maxDailyDrawdownPct: dto.maxDailyDrawdownPct ?? 5.0,
      },
    });

    await this.redis
      .publish(
        `trade-sync:group:${dto.syncGroupId}`,
        JSON.stringify({
          type: TRADE_SYNC_EVENTS.SLAVE_STATUS_CHANGE,
          slaveId: slave.id,
          status: 'ACTIVE',
        }),
      )
      .catch(() => {});

    return slave;
  }

  async pauseSlave(userId: string, slaveId: string) {
    const slave = await this.findSlaveOrThrow(slaveId, userId);

    if (slave.killSwitchTriggered) {
      throw new BadRequestException(
        'Cannot pause a killed account. Reset the kill switch first.',
      );
    }

    const updated = await this.prisma.slaveAccount.update({
      where: { id: slaveId },
      data: { status: 'PAUSED' },
    });

    await this.publishSlaveStatus(slave.syncGroupId, slaveId, 'PAUSED');
    return updated;
  }

  async resumeSlave(userId: string, slaveId: string) {
    const slave = await this.findSlaveOrThrow(slaveId, userId);

    if (slave.killSwitchTriggered) {
      throw new BadRequestException(
        'Cannot resume a killed account. Reset the kill switch first.',
      );
    }

    const updated = await this.prisma.slaveAccount.update({
      where: { id: slaveId },
      data: { status: 'ACTIVE' },
    });

    await this.publishSlaveStatus(slave.syncGroupId, slaveId, 'ACTIVE');
    return updated;
  }

  async triggerKillSwitch(userId: string, slaveId: string) {
    const slave = await this.findSlaveOrThrow(slaveId, userId);

    const updated = await this.prisma.slaveAccount.update({
      where: { id: slaveId },
      data: {
        status: 'KILLED',
        killSwitchTriggered: true,
      },
    });

    await this.redis
      .publish(
        `trade-sync:group:${slave.syncGroupId}`,
        JSON.stringify({
          type: TRADE_SYNC_EVENTS.KILL_SWITCH_TRIGGERED,
          slaveId,
          active: true,
        }),
      )
      .catch(() => {});

    await this.createAuditLog(
      slave.syncGroupId,
      userId,
      'KILL_SWITCH_TRIGGERED',
      { slaveId, slaveName: slave.displayName },
    );

    return updated;
  }

  async resetKillSwitch(userId: string, slaveId: string) {
    const slave = await this.findSlaveOrThrow(slaveId, userId);

    if (!slave.killSwitchTriggered) {
      throw new BadRequestException('Kill switch is not active');
    }

    const updated = await this.prisma.slaveAccount.update({
      where: { id: slaveId },
      data: {
        status: 'PAUSED',
        killSwitchTriggered: false,
        currentDailyDrawdownPct: 0,
      },
    });

    await this.redis
      .publish(
        `trade-sync:group:${slave.syncGroupId}`,
        JSON.stringify({
          type: TRADE_SYNC_EVENTS.KILL_SWITCH_TRIGGERED,
          slaveId,
          active: false,
        }),
      )
      .catch(() => {});

    await this.createAuditLog(slave.syncGroupId, userId, 'KILL_SWITCH_RESET', {
      slaveId,
      slaveName: slave.displayName,
    });

    return updated;
  }

  async updateRiskConfig(
    userId: string,
    slaveId: string,
    config: Record<string, any>,
  ) {
    const slave = await this.findSlaveOrThrow(slaveId, userId);

    // Merge existing riskConfig with new values
    const existingConfig = (slave.riskConfig as Record<string, any>) ?? {};
    const mergedConfig = { ...existingConfig, ...config };

    return this.prisma.slaveAccount.update({
      where: { id: slaveId },
      data: { riskConfig: mergedConfig },
    });
  }

  async updateSlaveHeartbeat(
    slaveId: string,
    data: {
      equity: number;
      balance: number;
      floatingPnL: number;
      accountNumber: string;
    },
  ) {
    const slave = await this.prisma.slaveAccount.update({
      where: { id: slaveId },
      data: {
        isConnected: true,
        lastHeartbeat: new Date(),
        equity: data.equity,
        balance: data.balance,
        floatingPnL: data.floatingPnL,
      },
    });

    // Check drawdown auto-kill
    const maxDrawdown = parseFloat((slave.maxDailyDrawdownPct ?? 5).toString());
    const currentDrawdown = parseFloat(
      (slave.currentDailyDrawdownPct ?? 0).toString(),
    );

    if (currentDrawdown >= maxDrawdown && !slave.killSwitchTriggered) {
      await this.prisma.slaveAccount.update({
        where: { id: slaveId },
        data: {
          status: 'KILLED',
          killSwitchTriggered: true,
        },
      });

      await this.redis
        .publish(
          `trade-sync:group:${slave.syncGroupId}`,
          JSON.stringify({
            type: TRADE_SYNC_EVENTS.KILL_SWITCH_TRIGGERED,
            slaveId,
            active: true,
            reason: `Drawdown ${currentDrawdown.toFixed(2)}% exceeded max ${maxDrawdown}%`,
          }),
        )
        .catch(() => {});
    }

    // Redis cache
    await this.redis
      .set(
        `sync:equity:slave:${slaveId}`,
        JSON.stringify({
          equity: data.equity,
          balance: data.balance,
          floatingPnL: data.floatingPnL,
        }),
        'EX',
        30,
      )
      .catch(() => {});

    // Snapshot debounce via Redis
    const snapKey = `sync:snapshot:slave:${slaveId}`;
    const exists = await this.redis.exists(snapKey);
    if (!exists) {
      await this.prisma.slaveEquitySnapshot
        .create({
          data: {
            slaveId,
            equity: data.equity,
            balance: data.balance,
            floatingPnL: data.floatingPnL,
            drawdownPct: currentDrawdown,
            snapshotAt: new Date(),
          },
        })
        .catch((err) => this.logger.warn('Slave snapshot failed', err));
      await this.redis.set(snapKey, '1', 'EX', 60);
    }

    await this.redis
      .publish(
        `trade-sync:group:${slave.syncGroupId}`,
        JSON.stringify({
          type: TRADE_SYNC_EVENTS.SLAVE_EQUITY_UPDATE,
          slaveId,
          equity: data.equity,
          balance: data.balance,
          floatingPnL: data.floatingPnL,
        }),
      )
      .catch(() => {});
  }

  async getSlavesByGroup(syncGroupId: string, userId: string) {
    const group = await this.prisma.syncGroup.findFirst({
      where: { id: syncGroupId, userId },
    });

    if (!group) {
      throw new NotFoundException('Sync group not found');
    }

    return this.prisma.slaveAccount.findMany({
      where: { syncGroupId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOwnedSlaveAccount(slaveId: string, userId: string) {
    const slave = await this.prisma.slaveAccount.findFirst({
      where: { id: slaveId, userId },
      select: { id: true, syncGroupId: true },
    });

    if (!slave) {
      throw new NotFoundException('Slave account not found');
    }

    return slave;
  }

  async deleteSlave(userId: string, slaveId: string) {
    const slave = await this.findSlaveOrThrow(slaveId, userId);

    await this.prisma.slaveAccount.delete({
      where: { id: slaveId },
    });

    await this.deleteKeysByPattern(`sync:*${slaveId}*`);

    await this.publishSlaveStatus(slave.syncGroupId, slaveId, 'STOPPED');
  }

  /* ───── helpers ───── */

  private async findSlaveOrThrow(slaveId: string, userId: string) {
    const slave = await this.prisma.slaveAccount.findFirst({
      where: { id: slaveId, userId },
    });

    if (!slave) {
      throw new NotFoundException('Slave account not found');
    }

    return slave;
  }

  private async publishSlaveStatus(
    syncGroupId: string,
    slaveId: string,
    status: string,
  ) {
    await this.redis
      .publish(
        `trade-sync:group:${syncGroupId}`,
        JSON.stringify({
          type: TRADE_SYNC_EVENTS.SLAVE_STATUS_CHANGE,
          slaveId,
          status,
        }),
      )
      .catch(() => {});
  }

  private async createAuditLog(
    syncGroupId: string,
    userId: string,
    action: string,
    details: Record<string, any>,
  ) {
    await this.prisma.syncAuditLog
      .create({
        data: {
          syncGroupId,
          userId,
          action,
          details,
          performedBy: userId,
        },
      })
      .catch((err) => this.logger.warn('Audit log failed', err));
  }

  private async deleteKeysByPattern(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        200,
      );

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      cursor = nextCursor;
    } while (cursor !== '0');
  }
}
