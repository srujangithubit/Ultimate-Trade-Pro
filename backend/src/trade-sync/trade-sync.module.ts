import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

// Providers
import { redisProvider, redisSubscriberProvider } from './redis.provider';

// Master
import { MasterService } from './master/master.service';
import { MasterController } from './master/master.controller';

// Slave
import { SlaveService } from './slave/slave.service';
import { SlaveController } from './slave/slave.controller';

// Replication
import { RiskEngineService } from './replication/risk-engine.service';
import { ReplicationEngine } from './replication/replication.engine';
import { ReplicationService } from './replication/replication.service';
import { ReplicationController } from './replication/replication.controller';
import { ReplicationGateway } from './replication/replication.gateway';

// Audit
import { AuditService } from './audit/audit.service';
import { AuditController } from './audit/audit.controller';

// Performance
import { PerformanceService } from './performance/performance.service';
import { PerformanceController } from './performance/performance.controller';

// MT5 Equity Poller
import { Mt5EquityPollerService } from './mt5-equity-poller.service';

// MT5 Trade Monitor (detects master trades)
import { Mt5TradeMonitorService } from './mt5-trade-monitor.service';

// Trade Executor (executes trades on slaves)
import { TradeExecutorService } from './trade-executor.service';

@Module({
  imports: [JwtModule.register({}), ConfigModule],
  controllers: [
    MasterController,
    SlaveController,
    AuditController,
    PerformanceController,
    ReplicationController,
  ],
  providers: [
    redisProvider,
    redisSubscriberProvider,
    MasterService,
    SlaveService,
    RiskEngineService,
    ReplicationEngine,
    ReplicationService,
    ReplicationGateway,
    AuditService,
    PerformanceService,
    Mt5EquityPollerService,
    Mt5TradeMonitorService,
    TradeExecutorService,
  ],
  exports: [MasterService, SlaveService, ReplicationService],
})
export class TradeSyncModule {}
