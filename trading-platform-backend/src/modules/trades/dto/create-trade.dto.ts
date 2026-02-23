import {
  IsArray,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTradeDto {
  @IsString()
  instrument: string;

  @IsString()
  @IsOptional()
  setup?: string;

  @IsString()
  @IsOptional()
  assetClass?: string;

  @IsString()
  entryDate: string;

  @IsString()
  @IsOptional()
  exitDate?: string;

  @IsEnum(['LONG', 'SHORT', 'long', 'short'])
  direction: 'LONG' | 'SHORT' | 'long' | 'short';

  @IsNumber()
  entryPrice: number;

  @IsNumber()
  @IsOptional()
  exitPrice?: number;

  @IsNumber()
  quantity: number;

  @IsNumber()
  @IsOptional()
  stopLoss?: number;

  @IsNumber()
  @IsOptional()
  takeProfit?: number;

  @IsNumber()
  @IsOptional()
  fees?: number;

  @IsNumber()
  @IsOptional()
  commission?: number;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @IsOptional()
  riskRewardRatio?: number;
}
