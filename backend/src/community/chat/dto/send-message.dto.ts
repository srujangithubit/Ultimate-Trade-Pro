import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  roomId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;
}
