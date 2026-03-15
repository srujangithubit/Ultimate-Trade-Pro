import { Controller, Get, Post, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ExecutionService } from '../services/execution.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
    user: { userId: string };
}

@Controller('charts/positions')
@UseGuards(JwtAuthGuard)
export class PositionController {
    constructor(private readonly executionService: ExecutionService) { }

    @Get()
    async getPositions(
        @Req() req: AuthenticatedRequest,
        @Query('status') status?: 'open' | 'closed',
    ) {
        return this.executionService.getPositions(req.user.userId, status);
    }

    @Post(':id/close')
    async closePosition(@Param('id') id: string) {
        // In production, current prices come from the tick stream
        const position = await this.executionService.closePosition(id, 0, 0);
        if (!position) {
            return { success: false, error: 'Position not found or already closed' };
        }
        return { success: true, position };
    }
}
