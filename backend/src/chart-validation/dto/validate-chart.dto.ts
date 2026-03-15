import {
  IsString,
  IsArray,
  IsNotEmpty,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

class ChecklistItemDto {
  @IsString()
  id: string;

  @IsString()
  rule: string;

  @IsString()
  type: string;
}

export class ValidateChartDto {
  @IsString()
  @IsNotEmpty()
  strategy_name: string;

  @IsArray()
  @IsString({ each: true })
  strategy_rules: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklist: ChecklistItemDto[];

  @IsString()
  @IsNotEmpty()
  screenshot: string; // base64 encoded image

  @IsString()
  @IsOptional()
  timeframe?: string;
}
