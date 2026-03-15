import { IsString, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderDto {
    @IsString()
    symbol: string;

    @IsEnum(['buy', 'sell'])
    side: 'buy' | 'sell';

    @IsEnum(['market', 'limit', 'stop'])
    type: 'market' | 'limit' | 'stop';

    @IsNumber()
    @Min(0.001)
    @Type(() => Number)
    volume: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    price?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    sl?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    tp?: number;
}

export class QueryCandlesDto {
    @IsString()
    symbol: string;

    @IsEnum(['1m', '5m', '15m', '1h'])
    timeframe: string;

    @IsString()
    from: string;

    @IsString()
    to: string;
}

export class QueryTicksDto {
    @IsString()
    symbol: string;

    @IsString()
    from: string;

    @IsString()
    to: string;
}

export class QueryPerformanceDto {
    @IsOptional()
    @IsString()
    from?: string;

    @IsOptional()
    @IsString()
    to?: string;
}

export class TickDto {
    @IsString()
    symbol: string;

    @IsNumber()
    @Type(() => Number)
    bid: number;

    @IsNumber()
    @Type(() => Number)
    ask: number;

    @IsNumber()
    @Type(() => Number)
    last: number;

    @IsNumber()
    @Type(() => Number)
    volume: number;

    @IsNumber()
    @Type(() => Number)
    timestamp: number;
}
