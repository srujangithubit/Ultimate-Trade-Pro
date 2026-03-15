import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../../auth/guard/jwt.guard';
import { AuditService } from './audit.service';

interface AuthRequest extends Request {
  user: { id: string; email: string };
}

@Controller('api/trade-sync/audit')
@UseGuards(JwtGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get(':syncGroupId')
  async getAuditLogs(
    @Req() req: AuthRequest,
    @Param('syncGroupId') syncGroupId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditService.getAuditLogs(syncGroupId, req.user.id, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }
}
