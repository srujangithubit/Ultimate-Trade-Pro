import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BacktestingService } from './backtesting.service';
import { CreateSessionDto, ExecuteOrderDto } from './dto/backtesting.dto';

@Controller('backtesting')
export class BacktestingController {
  constructor(private readonly backtestingService: BacktestingService) { }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @Body('userId') userId: string,
    @Body() dto: CreateSessionDto,
  ) {
    return this.backtestingService.createSession(userId, dto);
  }

  @Get('sessions/:userId')
  async listSessions(@Param('userId') userId: string) {
    return this.backtestingService.listSessions(userId);
  }

  @Get('sessions/:userId/:sessionId')
  async getSession(
    @Param('userId') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.backtestingService.getSession(userId, sessionId);
  }

  @Post('sessions/:sessionId/orders')
  @HttpCode(HttpStatus.CREATED)
  async executeOrder(
    @Body('userId') userId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: ExecuteOrderDto,
  ) {
    return this.backtestingService.executeOrder(userId, sessionId, dto);
  }

  @Patch('sessions/:sessionId/trades/:tradeId/close')
  async closeTrade(
    @Body('userId') userId: string,
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
    @Body('userId') userId: string,
    @Param('sessionId') sessionId: string,
    @Body('status') status: string,
  ) {
    return this.backtestingService.updateSessionStatus(
      userId,
      sessionId,
      status,
    );
  }

  @Delete('sessions/:userId/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(
    @Param('userId') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.backtestingService.deleteSession(userId, sessionId);
  }
}