import {
  IsString,
  MinLength,
  MaxLength,
  IsNumber,
  IsOptional,
} from 'class-validator';

export class RegisterMasterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  groupName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  displayName: string;

  @IsString()
  @MinLength(1)
  accountNumber: string;

  @IsString()
  @MinLength(1)
  brokerName: string;

  @IsString()
  @MinLength(1)
  serverName: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class HeartbeatDto {
  @IsString()
  accountId: string;

  @IsNumber()
  equity: number;

  @IsNumber()
  balance: number;

  @IsNumber()
  floatingPnL: number;

  @IsString()
  accountNumber: string;
}
