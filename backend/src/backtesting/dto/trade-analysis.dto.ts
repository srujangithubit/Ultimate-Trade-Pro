import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class TradeAnalysisFilterDto {
  @IsOptional()
  @IsIn(['all', 'account', 'backtest'])
  scope?: 'all' | 'account' | 'backtest';

  @IsOptional()
  @IsIn(['all', 'winners', 'losers'])
  outcome?: 'all' | 'winners' | 'losers';

  @IsOptional()
  @IsString()
  strategy?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;
}

export class SaveTradeJournalDto {
  @IsOptional()
  @IsString()
  tradeIdea?: string;

  @IsOptional()
  @IsString()
  mistakes?: string;

  @IsOptional()
  @IsString()
  emotion?: string;

  @IsOptional()
  @IsString()
  lessonsLearned?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  executionScore?: number;
}
