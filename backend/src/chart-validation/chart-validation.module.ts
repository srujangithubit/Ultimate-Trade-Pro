import { Module } from '@nestjs/common';
import { ChartValidationController } from './chart-validation.controller';
import { ChartValidationService } from './chart-validation.service';

@Module({
    controllers: [ChartValidationController],
    providers: [ChartValidationService],
})
export class ChartValidationModule {}
