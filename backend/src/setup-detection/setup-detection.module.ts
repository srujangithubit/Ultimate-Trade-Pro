import { Module } from '@nestjs/common';
import { SetupDetectionController } from './setup-detection.controller';
import { SetupDetectionService } from './setup-detection.service';

@Module({
  controllers: [SetupDetectionController],
  providers: [SetupDetectionService],
})
export class SetupDetectionModule {}
