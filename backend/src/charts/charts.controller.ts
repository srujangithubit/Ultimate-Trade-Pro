import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { ChartsService } from './charts.service';

@Controller('charts')
export class ChartsController {
  constructor(private readonly chartsService: ChartsService) {}

  @Get('symbols')
  getSymbols() {
    return this.chartsService.getSymbols();
  }

  @Get('candles')
  getCandles(
    @Query('symbol') symbol: string,
    @Query('timeframe') timeframe: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.chartsService.generateDemoCandles(
      symbol || 'EURUSD',
      timeframe || '5m',
      new Date(from || Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(to || Date.now()),
    );
  }

  @Get('ticks')
  getTicks(
    @Query('symbol') symbol: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    // Return empty for now — ticks come through Socket.IO in production
    return [];
  }

  @Get('performance')
  getPerformance() {
    return this.chartsService.getPerformanceStats();
  }

  @Get('positions')
  getPositions(@Query('status') status?: string) {
    // Return empty — positions are managed via Zustand on the frontend
    return [];
  }

  @Post('orders')
  createOrder(@Body() body: any) {
    // Demo: always confirm the order
    return {
      success: true,
      order: {
        id: `order-${Date.now()}`,
        ...body,
        status: 'filled',
        filledAt: new Date().toISOString(),
      },
      validation: {
        valid: true,
        reason: null,
        riskAmount: body.volume * 100,
        marginRequired: body.volume * 1000,
      },
    };
  }

  @Delete('orders/:id')
  cancelOrder(@Param('id') id: string) {
    return { success: true, order: { id, status: 'cancelled' } };
  }

  @Post('positions/:id/close')
  closePosition(@Param('id') id: string) {
    return {
      success: true,
      position: { id, closedAt: new Date().toISOString() },
    };
  }
}
