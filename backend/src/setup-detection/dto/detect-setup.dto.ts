import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class OhlcCandleDto {
  @IsString()
  time: string;

  @IsNumber()
  open: number;

  @IsNumber()
  high: number;

  @IsNumber()
  low: number;

  @IsNumber()
  close: number;

  @IsNumber()
  @IsOptional()
  volume?: number;
}

class StrategyDto {
  @IsString()
  name: string;

  @IsArray()
  @IsString({ each: true })
  rules: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  conditions?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class DetectSetupDto {
  @IsString()
  symbol: string;

  @IsString()
  timeframe: string;

  @IsNumber()
  current_price: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OhlcCandleDto)
  ohlc_data: OhlcCandleDto[];

  @ValidateNested()
  @Type(() => StrategyDto)
  strategy: StrategyDto;
}
