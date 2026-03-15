import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TRADING_SYMBOLS } from '../constants';

@Controller('charts/symbols')
@UseGuards(JwtAuthGuard)
export class SymbolController {
    @Get()
    getSymbols() {
        return TRADING_SYMBOLS;
    }
}
