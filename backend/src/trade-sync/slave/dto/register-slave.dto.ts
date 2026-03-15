import {
  IsString,
  IsObject,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RiskConfigDto {
  @IsEnum([
    'LOT_MULTIPLIER',
    'FIXED_LOT',
    'RISK_PERCENTAGE',
    'EQUITY_PERCENTAGE',
  ])
  mode:
    | 'LOT_MULTIPLIER'
    | 'FIXED_LOT'
    | 'RISK_PERCENTAGE'
    | 'EQUITY_PERCENTAGE';

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(10)
  lotMultiplier?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  fixedLot?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(10)
  riskPercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(10)
  equityPercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  maxLotSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  minLotSize?: number;

  @IsOptional()
  @IsBoolean()
  reverseDirection?: boolean;

  @IsOptional()
  @IsBoolean()
  copyStopLoss?: boolean;

  @IsOptional()
  @IsBoolean()
  copyTakeProfit?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  slippage?: number;
}

export class RegisterSlaveDto {
  @IsString()
  syncGroupId: string;

  @IsString()
  displayName: string;

  @IsString()
  accountNumber: string;

  @IsString()
  brokerName: string;

  @IsString()
  serverName: string;

  @IsObject()
  @ValidateNested()
  @Type(() => RiskConfigDto)
  riskConfig: RiskConfigDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbolFilters?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxDailyDrawdownPct?: number;
}
