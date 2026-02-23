import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  sessionName: string;

  @IsString()
  @IsNotEmpty()
  instrument: string;

  @IsString()
  @IsOptional()
  assetClass?: string;

  @IsNumber()
  startingBalance: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @IsOptional()
  playbookId?: string;

  @IsString()
  @IsNotEmpty()
  timeframe: string;
}
