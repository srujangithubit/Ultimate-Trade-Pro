import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../../auth/guard/jwt.guard';
import { PerformanceService } from './performance.service';

interface AuthRequest extends Request {
  user: { id: string; email: string };
}

@Controller('api/trade-sync/performance')
@UseGuards(JwtGuard)
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get(':syncGroupId')
  async getGroupPerformance(
    @Req() req: AuthRequest,
    @Param('syncGroupId') syncGroupId: string,
  ) {
    return this.performanceService.getGroupPerformance(
      syncGroupId,
      req.user.id,
    );
  }

  @Get(':syncGroupId/stats')
  async getReplicationStats(@Param('syncGroupId') syncGroupId: string) {
    return this.performanceService.getReplicationStats(syncGroupId);
  }
}
