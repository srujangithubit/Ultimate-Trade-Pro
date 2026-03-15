import { IsOptional, IsInt, IsEnum, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { Direction } from '@prisma/client';

export enum SortBy {
  LATEST = 'LATEST',
  MOST_LIKED = 'MOST_LIKED',
  MOST_COMMENTED = 'MOST_COMMENTED',
  TRENDING = 'TRENDING',
}

export class FeedQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;

  @IsOptional()
  @IsEnum(SortBy)
  sort: SortBy = SortBy.LATEST;

  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsString()
  timeframe?: string;

  @IsOptional()
  @IsEnum(Direction)
  direction?: Direction;

  @IsOptional()
  @IsString()
  userId?: string;
}
