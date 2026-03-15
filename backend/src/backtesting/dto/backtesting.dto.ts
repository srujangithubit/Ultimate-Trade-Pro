import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsNumber,
  Min,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  sessionName: string;

  @IsString()
  @IsNotEmpty()
  instrument: string;

  @IsString()
  @IsIn(['stock', 'crypto', 'forex', 'futures', 'options'])
  assetClass: string;

  @IsNumber()
  @Min(0)
  startingBalance: number;

  @IsString()
  @IsOptional()
  timeframe?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @IsOptional()
  accountId?: string;
}

export class ExecuteOrderDto {
  @IsString()
  @IsIn(['market', 'limit', 'stop', 'stop_limit'])
  orderType: string;

  @IsString()
  @IsIn(['long', 'short'])
  direction: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsNumber()
  @IsOptional()
  @Min(0.00000001)
  price?: number;

  @IsNumber()
  @IsOptional()
  stopPrice?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
