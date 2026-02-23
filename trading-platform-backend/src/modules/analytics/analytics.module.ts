import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Trade } from '../trades/entities/trade.entity';
import { MetricsCalculator } from './calculators/metrics.calculator';
import { EquityCurveCalculator } from './calculators/equity-curve.calculator';
import { DrawdownCalculator } from './calculators/drawdown.calculator';

@Module({
  imports: [TypeOrmModule.forFeature([Trade])],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    MetricsCalculator,
    EquityCurveCalculator,
    DrawdownCalculator,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
