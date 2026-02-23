import { IsString, IsOptional } from 'class-validator';

export class CreateAccountDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    broker?: string;

    @IsString()
    server: string;

    @IsString()
    accountLogin: string;

    @IsString()
    password?: string;

    @IsOptional()
    @IsString()
    accountType?: string;

    @IsOptional()
    @IsString()
    currency?: string;
}

export class UpdateAccountDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    broker?: string;
}
