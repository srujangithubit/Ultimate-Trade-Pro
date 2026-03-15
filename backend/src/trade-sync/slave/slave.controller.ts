import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../../auth/guard/jwt.guard';
import { SlaveService } from './slave.service';
import { RegisterSlaveDto, RiskConfigDto } from './dto/register-slave.dto';

interface AuthRequest extends Request {
  user: { id: string; email: string };
}

@Controller('api/trade-sync/slave')
@UseGuards(JwtGuard)
export class SlaveController {
  constructor(private readonly slaveService: SlaveService) {}

  @Post('register')
  async registerSlave(@Req() req: AuthRequest, @Body() dto: RegisterSlaveDto) {
    return this.slaveService.registerSlave(req.user.id, dto);
  }

  @Get('group/:syncGroupId')
  async getSlavesByGroup(
    @Req() req: AuthRequest,
    @Param('syncGroupId') syncGroupId: string,
  ) {
    return this.slaveService.getSlavesByGroup(syncGroupId, req.user.id);
  }

  @Post(':slaveId/pause')
  @HttpCode(HttpStatus.OK)
  async pauseSlave(@Req() req: AuthRequest, @Param('slaveId') slaveId: string) {
    return this.slaveService.pauseSlave(req.user.id, slaveId);
  }

  @Post(':slaveId/resume')
  @HttpCode(HttpStatus.OK)
  async resumeSlave(
    @Req() req: AuthRequest,
    @Param('slaveId') slaveId: string,
  ) {
    return this.slaveService.resumeSlave(req.user.id, slaveId);
  }

  @Post(':slaveId/kill')
  @HttpCode(HttpStatus.OK)
  async triggerKillSwitch(
    @Req() req: AuthRequest,
    @Param('slaveId') slaveId: string,
  ) {
    return this.slaveService.triggerKillSwitch(req.user.id, slaveId);
  }

  @Post(':slaveId/reset-kill')
  @HttpCode(HttpStatus.OK)
  async resetKillSwitch(
    @Req() req: AuthRequest,
    @Param('slaveId') slaveId: string,
  ) {
    return this.slaveService.resetKillSwitch(req.user.id, slaveId);
  }

  @Put(':slaveId/risk-config')
  async updateRiskConfig(
    @Req() req: AuthRequest,
    @Param('slaveId') slaveId: string,
    @Body() config: Partial<RiskConfigDto>,
  ) {
    return this.slaveService.updateRiskConfig(req.user.id, slaveId, config);
  }

  @Post(':slaveId/heartbeat')
  @HttpCode(HttpStatus.OK)
  async heartbeat(
    @Param('slaveId') slaveId: string,
    @Body()
    body: {
      equity: number;
      balance: number;
      floatingPnL: number;
      accountNumber: string;
    },
  ) {
    await this.slaveService.updateSlaveHeartbeat(slaveId, body);
    return { ok: true };
  }

  @Delete(':slaveId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSlave(
    @Req() req: AuthRequest,
    @Param('slaveId') slaveId: string,
  ) {
    await this.slaveService.deleteSlave(req.user.id, slaveId);
  }
}
