import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { AuthService, Tokens } from './auth.service';
import { AuthDto, RegisterDto } from './dto/auth.dto';
import { JwtGuard } from './guard';
import { GetUser } from './decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<Tokens> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: AuthDto): Promise<Tokens> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body('userId') userId: string,
    @Body('refreshToken') refreshToken: string,
  ): Promise<Tokens> {
    return this.authService.refreshToken(userId, refreshToken);
  }

  @UseGuards(JwtGuard)
  @Get('me')
  async getMe(@GetUser() user: any) {
    return user;
  }
}

