import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { TradingAccount } from './entities/trading-account.entity';
import { Trade } from '../trades/entities/trade.entity';

@Module({
    imports: [TypeOrmModule.forFeature([TradingAccount, Trade])],
    controllers: [AccountsController],
    providers: [AccountsService],
    exports: [AccountsService],
})
export class AccountsModule { }
