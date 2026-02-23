import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MarketDataService } from './services/market-data.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Timeframe } from './providers/market-data.interface';

@Controller('market-data')
@UseGuards(JwtAuthGuard)
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get('historical')
  async getHistoricalData(
    @Query('symbol') symbol: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('timeframe') timeframe: string = '1d',
  ) {
    return this.marketDataService.getHistoricalData(
      symbol,
      new Date(from),
      new Date(to),
      timeframe as Timeframe,
    );
  }
}
