import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class ExecuteOrderDto {
  @IsEnum(['market', 'limit', 'stop'])
  orderType: 'market' | 'limit' | 'stop';

  @IsEnum(['long', 'short'])
  direction: 'long' | 'short';

  @IsNumber()
  @IsOptional()
  quantity?: number;

  @IsNumber()
  @IsOptional()
  limitPrice?: number;

  @IsNumber()
  @IsOptional()
  stopPrice?: number;

  @IsNumber()
  @IsOptional()
  stopLoss?: number;

  @IsNumber()
  @IsOptional()
  takeProfit?: number;

  @IsNumber()
  @IsOptional()
  riskPercentage?: number;
}
