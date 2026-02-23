import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BacktestingService } from './backtesting.service';
import { BacktestingController } from './backtesting.controller';
import { BacktestingSession } from './entities/session.entity';
import { BacktestingTrade } from './entities/trade.entity';
import { BacktestingPosition } from './entities/position.entity';
import { MarketDataModule } from '../market-data/market-data.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { BacktestingGateway } from './backtesting.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BacktestingSession,
      BacktestingTrade,
      BacktestingPosition,
    ]),
    MarketDataModule,
    AnalyticsModule,
  ],
  controllers: [BacktestingController],
  providers: [BacktestingService, BacktestingGateway],
})
export class BacktestingModule {}
