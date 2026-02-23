import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';

export class AuthDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    password: string;
}

export class RegisterDto extends AuthDto {
    @IsString()
    @IsOptional()
    displayName?: string;
}
