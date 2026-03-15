import {
  Controller,
  Post,
  Get,
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
import { MasterService } from './master.service';
import { RegisterMasterDto, HeartbeatDto } from './dto/register-master.dto';

interface AuthRequest extends Request {
  user: { id: string; email: string };
}

@Controller('api/trade-sync/master')
@UseGuards(JwtGuard)
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  @Post('register')
  async registerMaster(
    @Req() req: AuthRequest,
    @Body() dto: RegisterMasterDto,
  ) {
    return this.masterService.registerMaster(req.user.id, dto);
  }

  @Get()
  async getUserSyncGroups(@Req() req: AuthRequest) {
    return this.masterService.getUserSyncGroups(req.user.id);
  }

  @Get(':syncGroupId')
  async getSyncGroup(
    @Req() req: AuthRequest,
    @Param('syncGroupId') syncGroupId: string,
  ) {
    return this.masterService.getSyncGroupById(syncGroupId, req.user.id);
  }

  @Delete(':syncGroupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSyncGroup(
    @Req() req: AuthRequest,
    @Param('syncGroupId') syncGroupId: string,
  ) {
    await this.masterService.deleteSyncGroup(req.user.id, syncGroupId);
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  async heartbeat(@Body() dto: HeartbeatDto) {
    await this.masterService.updateMasterHeartbeat(dto.accountId, dto);
    return { ok: true };
  }
}
