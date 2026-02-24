import { IsNumber, IsString, IsOptional } from 'class-validator';

export class HeartbeatDto {
  @IsString()
  account_login: string;

  @IsString()
  server: string;

  @IsNumber()
  balance: number;

  @IsNumber()
  equity: number;
}

export class Mt5TradeDto {
  @IsNumber()
  ticket: number;

  @IsString()
  symbol: string;

  @IsString()
  side: string;

  @IsNumber()
  entry: number;

  @IsNumber()
  exit: number;

  @IsOptional()
  @IsNumber()
  sl?: number;

  @IsOptional()
  @IsNumber()
  tp?: number;

  @IsNumber()
  lots: number;

  @IsNumber()
  profit: number;

  @IsString()
  open_time: string;

  @IsString()
  close_time: string;

  @IsOptional()
  @IsNumber()
  magic?: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsString()
  account_login: string;

  @IsString()
  server: string;
}
