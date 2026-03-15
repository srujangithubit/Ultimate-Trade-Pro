import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { TickEntity } from './entities/tick.entity';
import { CandleEntity } from './entities/candle.entity';
import { ChartOrderEntity } from './entities/chart-order.entity';
import { ChartPositionEntity } from './entities/chart-position.entity';
import { ChartAccountEntity } from './entities/chart-account.entity';
import { StrategyLogEntity } from './entities/strategy-log.entity';

// Services
import { CandleService } from './services/candle.service';
import { IndicatorService } from './services/indicator.service';
import { RiskService } from './services/risk.service';
import { ExecutionService } from './services/execution.service';
import { VirtualExecutionService } from './services/virtual-execution.service';

// Controllers
import { CandleController } from './controllers/candle.controller';
import { OrderController } from './controllers/order.controller';
import { PositionController } from './controllers/position.controller';
import { SymbolController } from './controllers/symbol.controller';
import { PerformanceController } from './controllers/performance.controller';

// Gateway
import { MarketGateway } from './gateways/market.gateway';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            TickEntity,
            CandleEntity,
            ChartOrderEntity,
            ChartPositionEntity,
            ChartAccountEntity,
            StrategyLogEntity,
        ]),
    ],
    controllers: [
        CandleController,
        OrderController,
        PositionController,
        SymbolController,
        PerformanceController,
    ],
    providers: [
        CandleService,
        IndicatorService,
        RiskService,
        ExecutionService,
        VirtualExecutionService,
        MarketGateway,
    ],
    exports: [
        CandleService,
        IndicatorService,
        RiskService,
        ExecutionService,
        VirtualExecutionService,
    ],
})
export class ChartsModule { }
