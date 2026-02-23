import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getOverview(
      user.id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('equity')
  getEquity(
    @CurrentUser() user: any,
    @Query('balance') startingBalance?: number,
  ) {
    return this.analyticsService.getEquityCurve(user.id, startingBalance);
  }

  @Get('drawdown')
  getDrawdown(
    @CurrentUser() user: any,
    @Query('balance') startingBalance?: number,
  ) {
    return this.analyticsService.getDrawdown(user.id, startingBalance);
  }
}
