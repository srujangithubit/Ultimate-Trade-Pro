import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, IsNull } from 'typeorm';
import { ChartPositionEntity } from '../entities/chart-position.entity';
import { CreateOrderDto } from '../dto';
import { TRADING_SYMBOLS, SymbolConfig } from '../constants';

export interface AccountState {
    equity: number;
    balance: number;
    dailyDrawdown: number;
    marginUsed: number;
}

export interface RiskValidationResult {
    valid: boolean;
    reason: string | null;
    riskAmount: number;
    marginRequired: number;
}

@Injectable()
export class RiskService {
    private readonly logger = new Logger(RiskService.name);

    /** Configuration — could be moved to DB per account */
    private readonly maxRiskPerTrade = 0.02; // 2% of equity
    private readonly dailyDrawdownCap = 0.05; // 5% of balance
    private readonly defaultLeverage = 100;

    constructor(
        @InjectRepository(ChartPositionEntity)
        private readonly positionRepo: Repository<ChartPositionEntity>,
    ) { }

    /**
     * Validate an order against risk limits before execution.
     */
    validateOrder(order: CreateOrderDto, account: AccountState): RiskValidationResult {
        const symbolConfig = this.getSymbolConfig(order.symbol);
        if (!symbolConfig) {
            return { valid: false, reason: `Unknown symbol: ${order.symbol}`, riskAmount: 0, marginRequired: 0 };
        }

        // Calculate risk amount
        let riskAmount = 0;
        if (order.sl !== undefined && order.sl !== null) {
            const slDistance = Math.abs((order.price ?? 0) - order.sl);
            const slPips = slDistance / symbolConfig.pipSize;
            riskAmount = order.volume * slPips * symbolConfig.pipValue;
        }

        // Calculate margin requirement
        const marginRequired = this.getMarginRequirement(order.symbol, order.volume);

        // Check 1: Max risk per trade
        const maxAllowedRisk = account.equity * this.maxRiskPerTrade;
        if (riskAmount > 0 && riskAmount > maxAllowedRisk) {
            return {
                valid: false,
                reason: `Risk $${riskAmount.toFixed(2)} exceeds max per trade $${maxAllowedRisk.toFixed(2)} (${(this.maxRiskPerTrade * 100).toFixed(0)}% of equity)`,
                riskAmount,
                marginRequired,
            };
        }

        // Check 2: Daily drawdown cap
        if (account.dailyDrawdown > account.balance * this.dailyDrawdownCap) {
            return {
                valid: false,
                reason: `Daily drawdown $${account.dailyDrawdown.toFixed(2)} exceeds cap of ${(this.dailyDrawdownCap * 100).toFixed(0)}% ($${(account.balance * this.dailyDrawdownCap).toFixed(2)})`,
                riskAmount,
                marginRequired,
            };
        }

        // Check 3: Margin requirement
        const availableMargin = account.equity - account.marginUsed;
        if (marginRequired > availableMargin) {
            return {
                valid: false,
                reason: `Margin required $${marginRequired.toFixed(2)} exceeds available $${availableMargin.toFixed(2)}`,
                riskAmount,
                marginRequired,
            };
        }

        // Check 4: Volume within symbol limits
        if (order.volume < symbolConfig.minVolume || order.volume > symbolConfig.maxVolume) {
            return {
                valid: false,
                reason: `Volume ${order.volume} outside allowed range [${symbolConfig.minVolume}, ${symbolConfig.maxVolume}]`,
                riskAmount,
                marginRequired,
            };
        }

        return { valid: true, reason: null, riskAmount, marginRequired };
    }

    /**
     * Calculate position size based on risk amount and SL distance.
     */
    calculatePositionSize(symbol: string, riskAmount: number, slPips: number): number {
        const config = this.getSymbolConfig(symbol);
        if (!config || slPips <= 0) return 0;

        const volume = riskAmount / (slPips * config.pipValue);
        // Round to volume step
        return Math.floor(volume / config.volumeStep) * config.volumeStep;
    }

    /**
     * Get margin requirement for a given symbol and volume.
     */
    getMarginRequirement(symbol: string, volume: number): number {
        const config = this.getSymbolConfig(symbol);
        if (!config) return 0;

        return (volume * config.contractSize) / this.defaultLeverage;
    }

    /**
     * Get total daily drawdown for an account (sum of closed position losses since midnight UTC).
     */
    async getDailyDrawdown(accountId: string): Promise<number> {
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);

        const closedToday = await this.positionRepo.find({
            where: {
                accountId,
                closedAt: MoreThanOrEqual(todayStart),
            },
            select: ['pnl'],
        });

        // Sum only losses (negative PnL)
        return closedToday.reduce((sum, p) => {
            const pnl = parseFloat(p.pnl);
            return sum + (pnl < 0 ? Math.abs(pnl) : 0);
        }, 0);
    }

    /**
     * Get current open positions for margin calculation.
     */
    async getOpenPositionMargin(accountId: string): Promise<number> {
        const openPositions = await this.positionRepo.find({
            where: { accountId, closedAt: IsNull() },
        });

        return openPositions.reduce((total, pos) => {
            return total + this.getMarginRequirement(pos.symbol, parseFloat(pos.volume));
        }, 0);
    }

    private getSymbolConfig(symbol: string): SymbolConfig | undefined {
        return TRADING_SYMBOLS.find((s) => s.symbol === symbol);
    }
}
