import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Get,
  Put,
} from '@nestjs/common';
import { BacktestingService } from './backtesting.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { ExecuteOrderDto } from './dto/execute-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnalyticsService } from '../analytics/analytics.service';

@Controller('backtesting')
@UseGuards(JwtAuthGuard)
export class BacktestingController {
  constructor(
    private readonly backtestingService: BacktestingService,
    private readonly analyticsService: AnalyticsService,
  ) { }

  @Get('sessions')
  getSessions(@CurrentUser() user: any) {
    return this.backtestingService.getUserSessions(user.id);
  }

  @Post('sessions')
  createSession(@CurrentUser() user: any, @Body() dto: CreateSessionDto) {
    return this.backtestingService.createSession(user.id, dto);
  }

  @Get('sessions/:id')
  getSession(@CurrentUser() user: any, @Param('id') id: string) {
    return this.backtestingService.getSession(id, user.id);
  }

  @Get('sessions/:id/report')
  async getReport(@CurrentUser() user: any, @Param('id') id: string) {
    const session = await this.backtestingService.getSession(id, user.id);

    // Filter and map trades
    const trades = (session.trades || [])
      .map((t) => ({
        ...t,
        pnlNet: t.pnlNet ?? 0,
        pnlGross: t.pnlGross ?? 0,
        fees: t.fees ?? 0,
        entryDatetime: new Date(t.entryDatetime),
        exitDatetime: new Date(t.exitDatetime),
      }))
      .sort((a, b) => a.entryDatetime.getTime() - b.entryDatetime.getTime());

    const stats = this.analyticsService.calculateStats(trades);
    const equityCurve = this.analyticsService.calculateEquityCurve(
      trades,
      session.startingBalance,
    );
    const drawdown = this.analyticsService.calculateDrawdown(equityCurve);

    return {
      stats,
      equityCurve,
      drawdown,
    };
  }

  @Post('sessions/:id/start')
  startPlayback(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('speed') speed?: number,
  ) {
    return this.backtestingService.startPlayback(id, user.id, speed);
  }

  @Post('sessions/:id/pause')
  pausePlayback(@CurrentUser() user: any, @Param('id') id: string) {
    return this.backtestingService.pausePlayback(id, user.id);
  }

  @Post('sessions/:id/orders')
  executeOrder(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ExecuteOrderDto,
  ) {
    return this.backtestingService.executeOrder(id, user.id, dto);
  }

  @Put('sessions/:sessionId/positions/:positionId/close')
  closePosition(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
    @Param('positionId') positionId: string,
  ) {
    return this.backtestingService.closePosition(
      positionId,
      sessionId,
      user.id,
    );
  }
}
