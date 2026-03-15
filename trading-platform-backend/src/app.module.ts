import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from './common/snake-naming.strategy';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BacktestingModule } from './modules/backtesting/backtesting.module';
import { MarketDataModule } from './modules/market-data/market-data.module';
import { TradesModule } from './modules/trades/trades.module';
import { BrokersModule } from './modules/brokers/brokers.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { EmailModule } from './modules/email/email.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { PlaybooksModule } from './modules/playbooks/playbooks.module';
import { ChartsModule } from './modules/charts/charts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT'),
        username: configService.get<string>('DATABASE_USER'),
        password: configService.get<string>('DATABASE_PASSWORD'),
        database: configService.get<string>('DATABASE_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        namingStrategy: new SnakeNamingStrategy(),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    BacktestingModule,
    MarketDataModule,
    TradesModule,
    BrokersModule,
    PaymentsModule,
    EmailModule,
    IntegrationsModule,
    AnalyticsModule,
    AccountsModule,
    PlaybooksModule,
    ChartsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
