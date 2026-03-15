import { Module } from '@nestjs/common';
import { ObservabilityService } from './observability.service';
import { PrismaModule } from '../prisma/prisma.module';
import { redisProvider } from '../trade-sync/redis.provider';
import { ObservabilityController } from './observability.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [ObservabilityController],
  providers: [redisProvider, ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
