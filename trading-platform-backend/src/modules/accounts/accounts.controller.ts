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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
    constructor(private readonly accountsService: AccountsService) { }

    @Post()
    create(@CurrentUser() user: any, @Body() dto: CreateAccountDto) {
        return this.accountsService.create(user.id, dto);
    }

    @Get()
    findAll(@CurrentUser() user: any) {
        return this.accountsService.findAll(user.id);
    }

    @Get(':id')
    findOne(@CurrentUser() user: any, @Param('id') id: string) {
        return this.accountsService.findOne(user.id, id);
    }

    @Get(':id/stats')
    getStats(@CurrentUser() user: any, @Param('id') id: string) {
        return this.accountsService.getStats(user.id, id);
    }

    @Patch(':id')
    update(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() dto: UpdateAccountDto,
    ) {
        return this.accountsService.update(user.id, id, dto);
    }

    @Patch(':id/toggle')
    toggle(@CurrentUser() user: any, @Param('id') id: string) {
        return this.accountsService.toggle(user.id, id);
    }

    @Post(':id/regenerate-key')
    regenerateKey(@CurrentUser() user: any, @Param('id') id: string) {
        return this.accountsService.regenerateKey(user.id, id);
    }

    @Delete(':id')
    remove(@CurrentUser() user: any, @Param('id') id: string) {
        return this.accountsService.remove(user.id, id);
    }
}
