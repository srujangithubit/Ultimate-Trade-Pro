import { Module } from '@nestjs/common';
import { Mt5Controller } from './mt5.controller';
import { Mt5Service } from './mt5.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountsModule } from '../accounts/accounts.module';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [PrismaModule, AccountsModule, ObservabilityModule],
  controllers: [Mt5Controller],
  providers: [Mt5Service],
})
export class Mt5Module {}
