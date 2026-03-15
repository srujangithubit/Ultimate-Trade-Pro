import {
  IsEnum,
  IsString,
  IsOptional,
  IsNumber,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PostType, Direction } from '@prisma/client';

export class CreatePostDto {
  @IsEnum(PostType)
  type: PostType;

  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Transform(({ value }: { value: string }) => value.toUpperCase().trim())
  symbol: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  timeframe: string;

  @IsEnum(Direction)
  direction: Direction;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }: { value: string }) =>
    value ? parseFloat(value) : undefined,
  )
  entry?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }: { value: string }) =>
    value ? parseFloat(value) : undefined,
  )
  sl?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }: { value: string }) =>
    value ? parseFloat(value) : undefined,
  )
  tp?: number;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @IsOptional()
  @IsString()
  chartState?: string;
}
