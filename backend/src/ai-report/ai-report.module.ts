import { Module } from '@nestjs/common';
import { AiReportController } from './ai-report.controller';
import { AiReportService } from './ai-report.service';
import { BacktestingModule } from '../backtesting/backtesting.module';

@Module({
  imports: [BacktestingModule],
  controllers: [AiReportController],
  providers: [AiReportService],
})
export class AiReportModule {}
