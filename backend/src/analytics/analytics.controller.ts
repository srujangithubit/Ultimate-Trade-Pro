import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { GetUser } from '../auth/decorator';
import { JwtGuard } from '../auth/guard';

@UseGuards(JwtGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) { }

  @Get('metrics')
  getMetrics(@GetUser('id') userId: string) {
    return this.analyticsService.getMetrics(userId);
  }

  @Get('overview')
  getOverview(@GetUser('id') userId: string) {
    return this.analyticsService.getOverview(userId);
  }

  @Get('equity')
  getEquity(@GetUser('id') userId: string) {
    return this.analyticsService.getEquityCurve(userId);
  }
}
