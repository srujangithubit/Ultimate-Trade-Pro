import { Injectable, Logger } from '@nestjs/common';

export interface RiskCheckResult {
  allowed: boolean;
  adjustedLot: number;
  reason?: string;
}

export interface TradeSignal {
  symbol: string;
  direction: 'BUY' | 'SELL';
  lot: number;
  stopLoss?: number;
  takeProfit?: number;
  price: number;
}

export interface SlaveRiskProfile {
  riskMode: string;
  lotMultiplier: number;
  fixedLot: number | null;
  riskPercentage: number | null;
  equityPercentage: number | null;
  maxLotSize: number;
  minLotSize: number;
  reverseDirection: boolean;
  copyStopLoss: boolean;
  copyTakeProfit: boolean;
  slippagePoints: number;
  symbolFilters: string[];
  equity: number;
  balance: number;
  killSwitchTriggered: boolean;
  status: string;
  currentDailyDrawdownPct: number;
  maxDailyDrawdownPct: number;
}

interface SymbolMeta {
  contractSize: number;
  tickSize: number;
  tickValue: number;
  pipValue: number;
  lotStep: number;
  pipSize: number;
}

@Injectable()
export class RiskEngineService {
  private readonly logger = new Logger(RiskEngineService.name);
  private readonly defaultSymbolMeta: SymbolMeta = {
    contractSize: 100000,
    tickSize: 0.00001,
    tickValue: 1,
    pipValue: 10,
    lotStep: 0.01,
    pipSize: 0.0001,
  };
  private readonly symbolMeta: Record<string, SymbolMeta> = {
    EURUSD: {
      contractSize: 100000,
      tickSize: 0.00001,
      tickValue: 1,
      pipValue: 10,
      lotStep: 0.01,
      pipSize: 0.0001,
    },
    GBPUSD: {
      contractSize: 100000,
      tickSize: 0.00001,
      tickValue: 1,
      pipValue: 10,
      lotStep: 0.01,
      pipSize: 0.0001,
    },
    USDJPY: {
      contractSize: 100000,
      tickSize: 0.001,
      tickValue: 0.67,
      pipValue: 6.7,
      lotStep: 0.01,
      pipSize: 0.01,
    },
    XAUUSD: {
      contractSize: 100,
      tickSize: 0.01,
      tickValue: 1,
      pipValue: 1,
      lotStep: 0.01,
      pipSize: 0.01,
    },
    BTCUSD: {
      contractSize: 1,
      tickSize: 0.01,
      tickValue: 0.01,
      pipValue: 0.01,
      lotStep: 0.001,
      pipSize: 0.01,
    },
  };

  evaluate(signal: TradeSignal, profile: SlaveRiskProfile): RiskCheckResult {
    // 1. Kill switch check
    if (profile.killSwitchTriggered || profile.status === 'KILLED') {
      return { allowed: false, adjustedLot: 0, reason: 'Kill switch active' };
    }

    // 2. Status check
    if (profile.status !== 'ACTIVE') {
      return {
        allowed: false,
        adjustedLot: 0,
        reason: `Slave status: ${profile.status}`,
      };
    }

    // 3. Symbol filter check
    if (
      profile.symbolFilters.length > 0 &&
      !profile.symbolFilters.includes(signal.symbol)
    ) {
      return {
        allowed: false,
        adjustedLot: 0,
        reason: `Symbol ${signal.symbol} not in allowed list`,
      };
    }

    // 4. Drawdown proximity check (within 1% of max)
    if (profile.currentDailyDrawdownPct >= profile.maxDailyDrawdownPct - 1) {
      return {
        allowed: false,
        adjustedLot: 0,
        reason: `Drawdown ${profile.currentDailyDrawdownPct.toFixed(2)}% near limit ${profile.maxDailyDrawdownPct}%`,
      };
    }

    // 5. Calculate lot size based on risk mode
    let adjustedLot = this.calculateLotSize(signal, profile);

    // 6. Clamp to min/max
    adjustedLot = Math.max(profile.minLotSize, adjustedLot);
    adjustedLot = Math.min(profile.maxLotSize, adjustedLot);

    // 7. Snap to symbol lot step
    adjustedLot = this.roundToLotStep(signal.symbol, adjustedLot);

    if (adjustedLot <= 0) {
      return {
        allowed: false,
        adjustedLot: 0,
        reason: 'Calculated lot size is zero',
      };
    }

    return { allowed: true, adjustedLot };
  }

  private calculateLotSize(
    signal: TradeSignal,
    profile: SlaveRiskProfile,
  ): number {
    const meta = this.getSymbolMeta(signal.symbol);

    switch (profile.riskMode) {
      case 'LOT_MULTIPLIER':
        return signal.lot * profile.lotMultiplier;

      case 'FIXED_LOT':
        return profile.fixedLot ?? signal.lot;

      case 'RISK_PERCENTAGE': {
        if (!profile.riskPercentage || !signal.stopLoss) {
          return signal.lot * profile.lotMultiplier;
        }
        const riskAmount = profile.equity * (profile.riskPercentage / 100);
        const stopLossPips =
          Math.abs(signal.price - signal.stopLoss) / meta.pipSize;
        if (stopLossPips <= 0) return signal.lot;
        return riskAmount / (stopLossPips * meta.pipValue);
      }

      case 'EQUITY_PERCENTAGE': {
        if (!profile.equityPercentage) {
          return signal.lot * profile.lotMultiplier;
        }
        const maxPosition = profile.equity * (profile.equityPercentage / 100);
        // Simplified: assume 1 standard lot margin = $1000
        return maxPosition / 1000;
      }

      default:
        this.logger.warn(`Unknown risk mode: ${profile.riskMode}`);
        return signal.lot;
    }
  }

  private getSymbolMeta(symbol: string): SymbolMeta {
    const normalized = symbol.toUpperCase();
    return this.symbolMeta[normalized] ?? this.defaultSymbolMeta;
  }

  private roundToLotStep(symbol: string, lot: number): number {
    const step = this.getSymbolMeta(symbol).lotStep;
    if (step <= 0) return lot;
    return Math.round(lot / step) * step;
  }

  adjustDirection(direction: 'BUY' | 'SELL', reverse: boolean): 'BUY' | 'SELL' {
    if (!reverse) return direction;
    return direction === 'BUY' ? 'SELL' : 'BUY';
  }

  adjustStopLoss(
    signal: TradeSignal,
    profile: SlaveRiskProfile,
  ): number | undefined {
    if (!profile.copyStopLoss) return undefined;
    return signal.stopLoss;
  }

  adjustTakeProfit(
    signal: TradeSignal,
    profile: SlaveRiskProfile,
  ): number | undefined {
    if (!profile.copyTakeProfit) return undefined;
    return signal.takeProfit;
  }
}
