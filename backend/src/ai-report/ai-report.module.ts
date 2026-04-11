import { Module } from '@nestjs/common';
import { AiReportController } from './ai-report.controller';
import { AiReportService } from './ai-report.service';

@Module({
  controllers: [AiReportController],
  providers: [AiReportService],
})
export class AiReportModule {}
