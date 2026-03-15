import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { SetupDetectionService } from './setup-detection.service';
import { DetectSetupDto } from './dto/detect-setup.dto';
import { JwtGuard } from '../auth/guard/jwt.guard';

@Controller('setup-detection')
@UseGuards(JwtGuard)
export class SetupDetectionController {
  constructor(private readonly setupDetectionService: SetupDetectionService) {}

  @Post('scan')
  @HttpCode(200)
  async detectSetup(@Body() dto: DetectSetupDto): Promise<unknown> {
    return this.setupDetectionService.detectSetup(dto) as Promise<unknown>;
  }
}
