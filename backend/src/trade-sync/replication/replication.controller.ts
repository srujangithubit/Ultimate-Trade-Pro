import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../../auth/guard/jwt.guard';
import { ReplicationService } from './replication.service';

interface AuthRequest extends Request {
  user: { id: string; email: string };
}

@Controller('api/trade-sync/replication')
@UseGuards(JwtGuard)
export class ReplicationController {
  constructor(private readonly replicationService: ReplicationService) {}

  @Get(':syncGroupId')
  async getHistory(
    @Req() req: AuthRequest,
    @Param('syncGroupId') syncGroupId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ) {
    return this.replicationService.getReplicationHistory(
      syncGroupId,
      req.user.id,
      {
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
        status,
      },
    );
  }
}
