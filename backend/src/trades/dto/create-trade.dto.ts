import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateTradeDto {
  @IsUUID()
  @IsOptional()
  accountId?: string;

  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsString()
  @IsOptional()
  setup?: string; // Added to support setup name

  @IsString()
  @IsNotEmpty()
  direction: string; // 'LONG' or 'SHORT'

  @IsString()
  @IsNotEmpty()
  entryDate: string; // ISO date string

  @IsString()
  @IsOptional()
  exitDate?: string;

  @IsNumber()
  @IsNotEmpty()
  entryPrice: number;

  @IsNumber()
  @IsOptional()
  exitPrice?: number;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsNumber()
  @IsOptional()
  fees?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  tags?: string[];
}
