import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/guard';
import { GetUser } from '../auth/decorator';
import { AiReportService } from './ai-report.service';

@UseGuards(JwtGuard)
@Controller('ai-report')
export class AiReportController {
  constructor(private readonly aiReportService: AiReportService) {}

  @Get()
  getReport(
    @GetUser('id') userId: string,
    @Query('accountId') accountId?: string,
  ) {
    return this.aiReportService.generate(userId, accountId);
  }
}
