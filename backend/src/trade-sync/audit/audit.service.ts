import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuditLogs(
    syncGroupId: string,
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    const group = await this.prisma.syncGroup.findFirst({
      where: { id: syncGroupId, userId },
    });

    if (!group) {
      throw new NotFoundException('Sync group not found');
    }

    const { limit = 50, offset = 0 } = options;

    const [logs, total] = await Promise.all([
      this.prisma.syncAuditLog.findMany({
        where: { syncGroupId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.syncAuditLog.count({ where: { syncGroupId } }),
    ]);

    return { logs, total, limit, offset };
  }

  async createLog(
    syncGroupId: string,
    userId: string,
    action: string,
    details: Record<string, any>,
  ) {
    return this.prisma.syncAuditLog.create({
      data: { syncGroupId, userId, action, details, performedBy: userId },
    });
  }
}
