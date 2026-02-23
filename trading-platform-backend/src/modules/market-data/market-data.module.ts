import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

// Providers
import { PolygonProvider } from './providers/polygon.provider';
import { AlphaVantageProvider } from './providers/alpha-vantage.provider';
import { YahooFinanceProvider } from './providers/yahoo-finance.provider';
import { BinanceMarketProvider } from './providers/binance-market.provider';

// Services
import { MarketDataService } from './services/market-data.service';
import { MarketDataCacheService } from './services/market-data-cache.service';

import { MarketDataController } from './market-data.controller';

/**
 * Market Data Module.
 * Provides 4 data providers with fallback chain and caching.
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 3,
    }),
  ],
  controllers: [MarketDataController],
  providers: [
    PolygonProvider,
    AlphaVantageProvider,
    YahooFinanceProvider,
    BinanceMarketProvider,
    MarketDataCacheService,
    MarketDataService,
  ],
  exports: [MarketDataService, MarketDataCacheService],
})
export class MarketDataModule {}
