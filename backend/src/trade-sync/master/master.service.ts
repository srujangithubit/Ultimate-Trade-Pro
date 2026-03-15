import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterMasterDto, HeartbeatDto } from './dto/register-master.dto';
import { REDIS_CLIENT } from '../redis.provider';
import { TRADE_SYNC_EVENTS } from '../trade-sync.events';
import type Redis from 'ioredis';
import type { SyncGroup } from '@prisma/client';

@Injectable()
export class MasterService {
  private readonly logger = new Logger(MasterService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async registerMaster(
    userId: string,
    dto: RegisterMasterDto,
  ): Promise<SyncGroup> {
    const group = await this.prisma.$transaction(async (tx) => {
      const syncGroup = await tx.syncGroup.create({
        data: {
          userId,
          name: dto.groupName,
          description: dto.description ?? null,
          status: 'ACTIVE',
        },
      });

      await tx.masterAccount.create({
        data: {
          syncGroupId: syncGroup.id,
          userId,
          accountNumber: dto.accountNumber,
          brokerName: dto.brokerName,
          serverName: dto.serverName,
          displayName: dto.displayName,
        },
      });

      return tx.syncGroup.findUniqueOrThrow({
        where: { id: syncGroup.id },
        include: { masterAccount: true, slaveAccounts: true },
      });
    });

    await this.redis
      .publish(
        'trade-sync:master:registered',
        JSON.stringify({ syncGroupId: group.id, userId }),
      )
      .catch((err) => this.logger.warn('Redis publish failed', err));

    return group;
  }

  async getUserSyncGroups(userId: string): Promise<SyncGroup[]> {
    return this.prisma.syncGroup.findMany({
      where: { userId },
      include: { masterAccount: true, slaveAccounts: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSyncGroupById(
    syncGroupId: string,
    userId: string,
  ): Promise<SyncGroup> {
    const group = await this.prisma.syncGroup.findFirst({
      where: { id: syncGroupId, userId },
      include: { masterAccount: true, slaveAccounts: true },
    });

    if (!group) {
      throw new NotFoundException('Sync group not found');
    }

    return group;
  }

  async getOwnedMasterAccount(masterId: string, userId: string): Promise<{
    id: string;
    syncGroupId: string;
  }> {
    const master = await this.prisma.masterAccount.findFirst({
      where: { id: masterId, userId },
      select: { id: true, syncGroupId: true },
    });

    if (!master) {
      throw new NotFoundException('Master account not found');
    }

    return master;
  }

  async updateMasterHeartbeat(
    masterId: string,
    data: HeartbeatDto,
  ): Promise<void> {
    const master = await this.prisma.masterAccount.update({
      where: { id: masterId },
      data: {
        isConnected: true,
        lastHeartbeat: new Date(),
        equity: data.equity,
        balance: data.balance,
        floatingPnL: data.floatingPnL,
      },
    });

    await this.redis
      .set(
        `sync:equity:master:${masterId}`,
        JSON.stringify({
          equity: data.equity,
          balance: data.balance,
          floatingPnL: data.floatingPnL,
        }),
        'EX',
        30,
      )
      .catch(() => {});

    // Snapshot every 60s (debounced via Redis TTL key)
    const snapKey = `sync:snapshot:master:${masterId}`;
    const exists = await this.redis.exists(snapKey);
    if (!exists) {
      await this.prisma.masterEquitySnapshot
        .create({
          data: {
            masterId,
            equity: data.equity,
            balance: data.balance,
            floatingPnL: data.floatingPnL,
            snapshotAt: new Date(),
          },
        })
        .catch((err) => this.logger.warn('Master snapshot failed', err));
      await this.redis.set(snapKey, '1', 'EX', 60);
    }

    await this.redis
      .publish(
        `trade-sync:group:${master.syncGroupId}`,
        JSON.stringify({
          type: TRADE_SYNC_EVENTS.MASTER_EQUITY_UPDATE,
          masterId,
          equity: data.equity,
          balance: data.balance,
          floatingPnL: data.floatingPnL,
        }),
      )
      .catch(() => {});
  }

  async markMasterDisconnected(masterId: string): Promise<void> {
    const master = await this.prisma.masterAccount.update({
      where: { id: masterId },
      data: { isConnected: false },
    });

    await this.prisma.syncGroup.update({
      where: { id: master.syncGroupId },
      data: { status: 'ERROR' },
    });

    await this.redis
      .publish(
        `trade-sync:group:${master.syncGroupId}`,
        JSON.stringify({
          type: TRADE_SYNC_EVENTS.CONNECTION_STATUS,
          masterId,
          connected: false,
        }),
      )
      .catch(() => {});
  }

  async deleteSyncGroup(userId: string, syncGroupId: string): Promise<void> {
    const group = await this.prisma.syncGroup.findFirst({
      where: { id: syncGroupId, userId },
    });

    if (!group) {
      throw new NotFoundException('Sync group not found');
    }

    await this.prisma.syncGroup.delete({
      where: { id: syncGroupId },
    });

    await this.deleteKeysByPattern(`sync:*${syncGroupId}*`);
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
