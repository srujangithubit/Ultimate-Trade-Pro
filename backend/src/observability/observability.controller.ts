import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ObservabilityService } from './observability.service';

interface ReplayDeterminismReportDto {
  deterministic: boolean;
  checkedAt: string;
  datasetHash: string;
  tradeSequenceHash?: string;
  pnlRun1?: number;
  pnlRun2?: number;
}

interface FinancialInvariantReportDto {
  healthy: boolean;
  checkedAt: string;
  invalidTradePrice: number;
  pnlMismatch: number;
  lotPrecisionViolation: number;
  timestampViolation: number;
  riskViolation: number;
}

@Controller('internal/observability')
export class ObservabilityController {
  constructor(
    private readonly observabilityService: ObservabilityService,
    private readonly configService: ConfigService,
  ) {}

  @Post('replay-determinism')
  async reportReplayDeterminism(
    @Headers('x-internal-api-key') internalApiKey: string | undefined,
    @Body() report: ReplayDeterminismReportDto,
  ) {
    const expected = this.configService.get<string>('MT5_INTERNAL_API_KEY');
    if (!expected || !internalApiKey || internalApiKey !== expected) {
      throw new ForbiddenException('Invalid internal API key');
    }

    if (!report.checkedAt || !report.datasetHash) {
      throw new ForbiddenException('Missing required replay determinism payload fields');
    }

    await this.observabilityService.recordReplayDeterminismResult(report);

    return {
      status: 'ok',
      replayDeterminismStatus: report.deterministic ? 1 : 0,
    };
  }

  @Post('financial-invariants')
  async reportFinancialInvariants(
    @Headers('x-internal-api-key') internalApiKey: string | undefined,
    @Body() report: FinancialInvariantReportDto,
  ) {
    const expected = this.configService.get<string>('MT5_INTERNAL_API_KEY');
    if (!expected || !internalApiKey || internalApiKey !== expected) {
      throw new ForbiddenException('Invalid internal API key');
    }

    if (!report.checkedAt) {
      throw new BadRequestException('Missing financial invariant checkedAt field');
    }

    await this.observabilityService.recordFinancialInvariantResult(report);

    return {
      status: 'ok',
      financialInvariantStatus: report.healthy ? 1 : 0,
    };
  }
}
