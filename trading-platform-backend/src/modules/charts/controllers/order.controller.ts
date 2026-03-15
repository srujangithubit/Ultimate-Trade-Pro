import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ExecutionService } from '../services/execution.service';
import { RiskService } from '../services/risk.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreateOrderDto } from '../dto';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
    user: { userId: string };
}

@Controller('charts/orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
    constructor(
        private readonly executionService: ExecutionService,
        private readonly riskService: RiskService,
    ) { }

    @Post()
    async createOrder(@Body() dto: CreateOrderDto, @Req() req: AuthenticatedRequest) {
        const accountId = req.user.userId;

        // Build account state for risk validation
        const dailyDrawdown = await this.riskService.getDailyDrawdown(accountId);
        const marginUsed = await this.riskService.getOpenPositionMargin(accountId);

        const accountState = {
            equity: 100000, // TODO: fetch from account entity
            balance: 100000,
            dailyDrawdown,
            marginUsed,
        };

        const validation = this.riskService.validateOrder(dto, accountState);
        if (!validation.valid) {
            return { success: false, error: validation.reason, validation };
        }

        // For market orders we need a current price. Use 0 as placeholder;
        // in production this comes from the tick stream.
        const order = await this.executionService.submitOrder(dto, accountId, 0, 0);
        return { success: true, order, validation };
    }

    @Delete(':id')
    async cancelOrder(@Param('id') id: string) {
        const order = await this.executionService.cancelOrder(id);
        if (!order) {
            return { success: false, error: 'Order not found or not pending' };
        }
        return { success: true, order };
    }

    @Get()
    async getOrders(@Req() req: AuthenticatedRequest) {
        const orders = await this.executionService.getOrders(req.user.userId);
        return orders;
    }
}
