import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreatePlaybookDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    rules?: string[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];

    @IsString()
    @IsOptional()
    userId?: string;
}
