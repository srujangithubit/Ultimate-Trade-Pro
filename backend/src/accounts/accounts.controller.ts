import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';
import { JwtGuard } from '../auth/guard';
import { GetUser } from '../auth/decorator';

@UseGuards(JwtGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  create(@GetUser('id') userId: string, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(userId, dto);
  }

  @Get()
  findAll(@GetUser('id') userId: string) {
    return this.accountsService.findAll(userId);
  }

  @Get(':id')
  findOne(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.accountsService.findOne(userId, id);
  }

  @Get(':id/stats')
  getStats(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.accountsService.getStats(userId, id);
  }

  @Patch(':id')
  update(
    @GetUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.update(userId, id, dto);
  }

  @Patch(':id/toggle')
  toggle(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.accountsService.toggle(userId, id);
  }

  @Post(':id/regenerate-key')
  regenerateKey(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.accountsService.regenerateKey(userId, id);
  }

  @Delete(':id')
  remove(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.accountsService.remove(userId, id);
  }
}
