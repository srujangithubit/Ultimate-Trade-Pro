import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CandleService } from '../services/candle.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { QueryCandlesDto, QueryTicksDto } from '../dto';

@Controller('charts')
@UseGuards(JwtAuthGuard)
export class CandleController {
    constructor(private readonly candleService: CandleService) { }

    @Get('candles')
    async getCandles(@Query() query: QueryCandlesDto) {
        return this.candleService.getHistoricalCandles(
            query.symbol,
            query.timeframe,
            new Date(query.from),
            new Date(query.to),
        );
    }

    @Get('ticks')
    async getTicks(@Query() query: QueryTicksDto) {
        return this.candleService.getHistoricalTicks(
            query.symbol,
            new Date(query.from),
            new Date(query.to),
        );
    }
}
