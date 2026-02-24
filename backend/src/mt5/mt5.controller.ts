import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { Mt5Service } from './mt5.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { HeartbeatDto, Mt5TradeDto } from './dto/mt5.dto';
import { TradingAccount } from '@prisma/client';

interface Mt5Request extends Request {
  tradingAccount: TradingAccount;
  accountUserId: string;
}

@Controller('api/mt5')
export class Mt5Controller {
  constructor(private readonly mt5Service: Mt5Service) {}

  @Post('heartbeat')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async heartbeat(@Req() req: Mt5Request, @Body() dto: HeartbeatDto) {
    return this.mt5Service.processHeartbeat(req.tradingAccount, dto);
  }

  @Post('trade')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async trade(@Req() req: Mt5Request, @Body() dto: Mt5TradeDto) {
    return this.mt5Service.processTrade(
      req.tradingAccount,
      req.accountUserId,
      dto,
    );
  }
}
