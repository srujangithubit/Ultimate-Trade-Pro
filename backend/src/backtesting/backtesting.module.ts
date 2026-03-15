import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { BacktestingService } from './backtesting.service';
import { BacktestingController } from './backtesting.controller';
import { BacktestingGateway } from './backtesting.gateway';
import { CandleLoaderService } from './replay/candle-loader.service';
import { MarketDataModule } from '../market-data/market-data.module';
import { redisProvider } from '../trade-sync/redis.provider';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [MarketDataModule, JwtModule.register({}), ConfigModule, ObservabilityModule],
  controllers: [BacktestingController],
  providers: [
    redisProvider,
    BacktestingService,
    BacktestingGateway,
    CandleLoaderService,
  ],
  exports: [BacktestingService],
})
export class BacktestingModule {}
