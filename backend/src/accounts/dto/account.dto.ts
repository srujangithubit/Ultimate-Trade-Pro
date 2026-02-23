import { IsString, IsOptional } from 'class-validator';

export class CreateAccountDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    broker?: string;

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
