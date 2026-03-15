import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ChartValidationService } from './chart-validation.service';
import { ValidateChartDto } from './dto/validate-chart.dto';
import { JwtGuard } from '../auth/guard/jwt.guard';

@Controller('chart-validation')
@UseGuards(JwtGuard)
export class ChartValidationController {
  constructor(
    private readonly chartValidationService: ChartValidationService,
  ) {}

  @Post('validate')
  @HttpCode(200)
  async validateChart(@Body() dto: ValidateChartDto) {
    return this.chartValidationService.validateChart(dto);
  }
}
