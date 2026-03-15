import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { BacktestingService } from './backtesting.service';
import { CreateSessionDto, ExecuteOrderDto } from './dto/backtesting.dto';
import { SaveTradeJournalDto, TradeAnalysisFilterDto } from './dto/trade-analysis.dto';
import { JwtGuard } from '../auth/guard';
import { GetUser } from '../auth/decorator';

@UseGuards(JwtGuard)
@Controller('backtesting')
export class BacktestingController {
  constructor(private readonly backtestingService: BacktestingService) { }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @GetUser('id') userId: string,
    @Body() dto: CreateSessionDto,
  ) {
    return this.backtestingService.createSession(userId, dto);
  }

  private mapSessionState(session: any) {
    const config = (session.configuration || {}) as Record<string, any>;
    const startBal = Number(config.startingBalance) || 0;
    // Compute current balance from starting balance + realized P&L of closed trades
    const trades = session.trades || [];
    const realizedPnL = trades
      .filter((t: any) => t.status === 'CLOSED' && t.pnlNet != null)
      .reduce((sum: number, t: any) => sum + Number(t.pnlNet), 0);
    return {
      ...session,
      instrument: config.instrument || 'UNKNOWN',
      timeframe: config.timeframe || '1h',
      timezone: config.timezone || 'UTC',
      startDate: config.startDate,
      endDate: config.endDate,
      startingBalance: startBal,
      currentBalance: startBal + realizedPnL,
      replayIndex: session.replayIndex ?? 0,
      totalCandles: session.totalCandles ?? 0,
      config: config,
      trades: (session.trades || []).map((t: any) => ({
        id: t.id,
        symbol: t.symbol,
        direction: t.direction,
        entryDate: t.entryDate,
        exitDate: t.exitDate,
        entryPrice: Number(t.entryPrice),
        exitPrice: t.exitPrice != null ? Number(t.exitPrice) : null,
        quantity: Number(t.quantity),
        stopLoss: t.stopLoss != null ? Number(t.stopLoss) : null,
        takeProfit: t.takeProfit != null ? Number(t.takeProfit) : null,
        pnlGross: t.pnlGross != null ? Number(t.pnlGross) : null,
        pnlNet: t.pnlNet != null ? Number(t.pnlNet) : null,
        status: t.status,
      })),
    };
  }

  @Get('sessions')
  async listSessions(@GetUser('id') userId: string) {
    const sessions = await this.backtestingService.listSessions(userId);
    return sessions.map(s => this.mapSessionState(s));
  }

  @Get('sessions/:sessionId')
  async getSession(
    @GetUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    const session = await this.backtestingService.getSession(userId, sessionId);
    return this.mapSessionState(session);
  }

  @Post('sessions/:sessionId/orders')
  @HttpCode(HttpStatus.CREATED)
  async executeOrder(
    @GetUser('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: ExecuteOrderDto,
  ) {
    return this.backtestingService.executeOrder(userId, sessionId, dto);
  }

  @Patch('sessions/:sessionId/trades/:tradeId/close')
  async closeTrade(
    @GetUser('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Param('tradeId') tradeId: string,
    @Body('exitPrice') exitPrice: number,
  ) {
    return this.backtestingService.closeTrade(
      userId,
      sessionId,
      tradeId,
      exitPrice,
    );
  }

  @Patch('sessions/:sessionId/status')
  async updateStatus(
    @GetUser('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Body('status') status: string,
  ) {
    return this.backtestingService.updateSessionStatus(
      userId,
      sessionId,
      status,
    );
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(
    @GetUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.backtestingService.deleteSession(userId, sessionId);
  }

  @Get('sessions/:sessionId/report')
  async getSessionReport(
    @GetUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.backtestingService.getSessionReport(userId, sessionId);
  }

  @Get('debug/candles')
  async debugCandles() {
    return this.backtestingService.debugCandles();
  }

  @Get('sessions/:sessionId/candles')
  async getCandles(
    @GetUser('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Query('resolution') resolution?: string,
  ) {
    try {
      const session = await this.backtestingService.getSession(userId, sessionId);
      const candles = await this.backtestingService.loadCandlesForSession(session, resolution);
      return candles;
    } catch (e) {
      throw e;
    }
  }

  @Get('sessions/:sessionId/candles/history')
  async getHistoryCandles(
    @GetUser('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Query('resolution') resolution?: string,
    @Query('limit') limit?: string,
  ) {
    const session = await this.backtestingService.getSession(userId, sessionId);
    return this.backtestingService.loadHistoryBeforeSession(
      session,
      resolution,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('sessions/:sessionId/candles/validate')
  async validateCandleData(@Param('sessionId') sessionId: string) {
    return this.backtestingService.validateCandleData(sessionId);
  }

  // ─── Trade Analysis ───────────────────────────────────────────

  @Get('trade-analysis/trades')
  async getTradeAnalysisTrades(
    @GetUser('id') userId: string,
    @Query() query: TradeAnalysisFilterDto,
  ) {
    return this.backtestingService.getTradeAnalysisTrades(userId, query);
  }

  @Get('trade-analysis/trades/:tradeId/replay')
  async getTradeReplay(
    @GetUser('id') userId: string,
    @Param('tradeId') tradeId: string,
    @Query('timeframe') timeframe?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('limit') limit?: string,
  ) {
    return this.backtestingService.getTradeReplayData(userId, tradeId, {
      timeframe,
      before: before ? parseInt(before, 10) : undefined,
      after: after ? parseInt(after, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('trade-analysis/trades/:tradeId/journal')
  async getTradeJournal(
    @GetUser('id') userId: string,
    @Param('tradeId') tradeId: string,
  ) {
    return this.backtestingService.getTradeJournal(userId, tradeId);
  }

  @Patch('trade-analysis/trades/:tradeId/journal')
  async saveTradeJournal(
    @GetUser('id') userId: string,
    @Param('tradeId') tradeId: string,
    @Body() dto: SaveTradeJournalDto,
  ) {
    return this.backtestingService.saveTradeJournal(userId, tradeId, dto);
  }

  // ─── Chart Drawings ─────────────────────────────────────────────

  @Get('sessions/:sessionId/drawings')
  async getDrawings(
    @GetUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.backtestingService.getDrawings(userId, sessionId);
  }

  @Patch('sessions/:sessionId/drawings')
  async saveDrawings(
    @GetUser('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Body() drawings: Record<string, unknown>[],
  ) {
    return this.backtestingService.saveDrawings(userId, sessionId, drawings);
  }
}
