import { IsNotEmpty, IsObject, IsString, IsOptional } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  @IsOptional()
  configuration?: any; // Define structure later or use 'any' for now since it's JSONB
}
