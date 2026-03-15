import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ReputationService } from './reputation.service';
import { JwtGuard } from '../../auth/guard/jwt.guard';

@Controller('api/community/reputation')
@UseGuards(JwtGuard)
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  @Get('leaderboard')
  async getLeaderboard(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.reputationService.getLeaderboard(
      isNaN(parsedLimit) ? 10 : Math.min(parsedLimit, 50),
    );
  }

  @Get(':userId')
  async getUserReputation(@Param('userId') userId: string) {
    return this.reputationService.getUserReputation(userId);
  }
}
