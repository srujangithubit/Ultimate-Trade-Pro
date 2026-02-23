import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { GetUser } from '../auth/decorator';
import { JwtGuard } from '../auth/guard';
import { EditUserDto } from './dto/edit-user.dto';
import { UsersService } from './users.service';

@UseGuards(JwtGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) { }

  @Get('me')
  getMe(@GetUser() user: any) {
    return user;
  }

  @Patch('me')
  editUser(@GetUser('id') userId: string, @Body() dto: EditUserDto) {
    return this.usersService.editUser(userId, dto);
  }
}
