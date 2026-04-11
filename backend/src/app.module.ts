import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { BacktestingModule } from './backtesting/backtesting.module';
import { TradesModule } from './trades/trades.module';
import { UsersModule } from './users/users.module';
import { AccountsModule } from './accounts/accounts.module';
import { Mt5Module } from './mt5/mt5.module';
import { PlaybooksModule } from './playbooks/playbooks.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ChartsModule } from './charts/charts.module';
import { MarketDataModule } from './market-data/market-data.module';
import { CommunityModule } from './community/community.module';
import { TradeSyncModule } from './trade-sync/trade-sync.module';
import { ChartValidationModule } from './chart-validation/chart-validation.module';
import { SetupDetectionModule } from './setup-detection/setup-detection.module';
import { CommonModule } from './common/common.module';
import { ObservabilityModule } from './observability/observability.module';
import { AiReportModule } from './ai-report/ai-report.module';
import { AppGateway } from './app.gateway';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

const restRateLimitPerMinute = Number(
  process.env.RATE_LIMIT_REQUESTS_PER_MINUTE ?? '100',
);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit:
            Number.isFinite(restRateLimitPerMinute) && restRateLimitPerMinute > 0
              ? restRateLimitPerMinute
              : 100,
        },
      ],
    }),
    CommonModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    BacktestingModule,
    TradesModule,
    UsersModule,
    AccountsModule,
    Mt5Module,
    PlaybooksModule,
    AnalyticsModule,
    ChartsModule,
    MarketDataModule,
    CommunityModule,
    TradeSyncModule,
    ChartValidationModule,
    SetupDetectionModule,
    AiReportModule,
    ObservabilityModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppGateway,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
