import { IsString, IsOptional, IsArray, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePlaybookDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    rules?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];
}

export class UpdatePlaybookDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    rules?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];
}
