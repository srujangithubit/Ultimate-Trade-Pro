import { RiskEngineService, SlaveRiskProfile, TradeSignal } from './risk-engine.service';

describe('RiskEngineService', () => {
  let service: RiskEngineService;

  const baseProfile: SlaveRiskProfile = {
    riskMode: 'RISK_PERCENTAGE',
    lotMultiplier: 1,
    fixedLot: null,
    riskPercentage: 1,
    equityPercentage: null,
    maxLotSize: 100,
    minLotSize: 0.01,
    reverseDirection: false,
    copyStopLoss: true,
    copyTakeProfit: true,
    slippagePoints: 0,
    symbolFilters: [],
    equity: 10000,
    balance: 10000,
    killSwitchTriggered: false,
    status: 'ACTIVE',
    currentDailyDrawdownPct: 0,
    maxDailyDrawdownPct: 10,
  };

  beforeEach(() => {
    service = new RiskEngineService();
  });

  it('should produce symbol-aware lot sizes in RISK_PERCENTAGE mode', () => {
    const eurSignal: TradeSignal = {
      symbol: 'EURUSD',
      direction: 'BUY',
      lot: 0.1,
      price: 1.1,
      stopLoss: 1.099,
      takeProfit: 1.102,
    };

    const xauSignal: TradeSignal = {
      symbol: 'XAUUSD',
      direction: 'BUY',
      lot: 0.1,
      price: 2000,
      stopLoss: 1990,
      takeProfit: 2015,
    };

    const eur = service.evaluate(eurSignal, baseProfile);
    const xau = service.evaluate(xauSignal, baseProfile);

    expect(eur.allowed).toBe(true);
    expect(xau.allowed).toBe(true);
    expect(eur.adjustedLot).toBe(1);
    expect(xau.adjustedLot).toBe(0.1);
  });

  it('should round adjusted lot to symbol lot step', () => {
    const signal: TradeSignal = {
      symbol: 'BTCUSD',
      direction: 'BUY',
      lot: 0.1234,
      price: 50000,
      stopLoss: 49000,
      takeProfit: 52000,
    };

    const profile: SlaveRiskProfile = {
      ...baseProfile,
      riskMode: 'LOT_MULTIPLIER',
      lotMultiplier: 1,
    };

    const result = service.evaluate(signal, profile);

    expect(result.allowed).toBe(true);
    expect(result.adjustedLot).toBe(0.123);
  });
});
