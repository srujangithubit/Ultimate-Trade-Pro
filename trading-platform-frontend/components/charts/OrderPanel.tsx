'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMT5 } from '@/components/mt5/MT5Context';
import { useTradingStore } from '@/lib/stores/tradingStore';
import { ChevronDown, ChevronUp, AlertCircle, Loader2 } from 'lucide-react';

// ─── Symbol configuration for pip/contract calculations ─────────────────────

interface SymbolSpec {
  digits: number;          // decimal places for price display
  pipSize: number;         // size of 1 pip (e.g., 0.0001 for EURUSD)
  tickSize: number;        // minimum price increment
  contractSize: number;    // 1 lot in base units
  tickValue: number;       // USD value of 1 tick for 1 lot
  minVolume: number;       // minimum lot size
  maxVolume: number;       // maximum lot size
  volumeStep: number;      // lot step
  marginRate: number;      // fraction of notional value as margin (1/leverage)
}

const SYMBOL_SPECS: Record<string, SymbolSpec> = {
  EURUSD:  { digits: 5, pipSize: 0.0001,  tickSize: 0.00001, contractSize: 100_000, tickValue: 1.00,  minVolume: 0.01, maxVolume: 100, volumeStep: 0.01, marginRate: 0.01 },
  GBPUSD:  { digits: 5, pipSize: 0.0001,  tickSize: 0.00001, contractSize: 100_000, tickValue: 1.00,  minVolume: 0.01, maxVolume: 100, volumeStep: 0.01, marginRate: 0.01 },
  USDJPY:  { digits: 3, pipSize: 0.01,    tickSize: 0.001,   contractSize: 100_000, tickValue: 0.67,  minVolume: 0.01, maxVolume: 100, volumeStep: 0.01, marginRate: 0.01 },
  EURGBP:  { digits: 5, pipSize: 0.0001,  tickSize: 0.00001, contractSize: 100_000, tickValue: 1.27,  minVolume: 0.01, maxVolume: 100, volumeStep: 0.01, marginRate: 0.01 },
  XAUUSD:  { digits: 3, pipSize: 0.01,    tickSize: 0.001,   contractSize: 100,     tickValue: 0.10,  minVolume: 0.01, maxVolume: 100, volumeStep: 0.01, marginRate: 0.01 },
  BTCUSD:  { digits: 2, pipSize: 0.01,    tickSize: 0.01,    contractSize: 1,       tickValue: 0.01,  minVolume: 0.01, maxVolume: 10,  volumeStep: 0.01, marginRate: 0.01 },
  US500:   { digits: 2, pipSize: 0.01,    tickSize: 0.01,    contractSize: 50,      tickValue: 0.50,  minVolume: 0.01, maxVolume: 100, volumeStep: 0.01, marginRate: 0.01 },
  NAS100:  { digits: 2, pipSize: 0.01,    tickSize: 0.01,    contractSize: 20,      tickValue: 0.20,  minVolume: 0.01, maxVolume: 100, volumeStep: 0.01, marginRate: 0.01 },
};

const DEFAULT_SPEC: SymbolSpec = {
  digits: 5, pipSize: 0.0001, tickSize: 0.00001, contractSize: 100_000, tickValue: 1.00,
  minVolume: 0.01, maxVolume: 100, volumeStep: 0.01, marginRate: 0.01,
};

function getSpec(symbol: string): SymbolSpec {
  return SYMBOL_SPECS[symbol] ?? DEFAULT_SPEC;
}

// ─── Unit Mode: lots vs units ───────────────────────────────────────────────

type UnitMode = 'lots' | 'units';
type OrderType = 'market' | 'limit' | 'stop';

// ─── Component ──────────────────────────────────────────────────────────────

export default function OrderPanel() {
  const activeSymbol = useTradingStore((s) => s.activeSymbol);
  const mt5 = useMT5();
  const tick = mt5.ticks[activeSymbol];
  const account = mt5.account;
  const spec = getSpec(activeSymbol);

  // ─── Form state ─────────────────────────
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [unitMode, setUnitMode] = useState<UnitMode>('lots');
  const [volume, setVolume] = useState(0.01);
  const [limitPrice, setLimitPrice] = useState('');

  const [tpEnabled, setTpEnabled] = useState(false);
  const [slEnabled, setSlEnabled] = useState(false);
  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');

  const [exitsOpen, setExitsOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ─── Derived prices ─────────────────────
  const bid = tick?.bid ?? 0;
  const ask = tick?.ask ?? 0;
  const spread = bid && ask ? Math.round((ask - bid) / spec.tickSize) : 0;
  const entryPrice = side === 'BUY' ? ask : bid;

  // Units display (volume × contractSize)
  const units = Math.round(volume * spec.contractSize);

  // Notional value
  const notional = useMemo(() => {
    const price = entryPrice || 0;
    return volume * spec.contractSize * price;
  }, [volume, spec.contractSize, entryPrice]);

  // Margin required
  const marginRequired = useMemo(() => {
    const leverage = account?.leverage ?? 100;
    return notional / leverage;
  }, [notional, account?.leverage]);

  // Tick calculations for TP and SL
  const tpTicks = useMemo(() => {
    if (!tpEnabled || !tpPrice || !entryPrice) return 0;
    const tp = parseFloat(tpPrice);
    if (isNaN(tp)) return 0;
    const diff = side === 'BUY' ? tp - entryPrice : entryPrice - tp;
    return Math.round(diff / spec.tickSize);
  }, [tpEnabled, tpPrice, entryPrice, side, spec.tickSize]);

  const slTicks = useMemo(() => {
    if (!slEnabled || !slPrice || !entryPrice) return 0;
    const sl = parseFloat(slPrice);
    if (isNaN(sl)) return 0;
    const diff = side === 'BUY' ? entryPrice - sl : sl - entryPrice;
    return Math.round(diff / spec.tickSize);
  }, [slEnabled, slPrice, entryPrice, side, spec.tickSize]);

  // Risk/Reward ratio
  const rrRatio = useMemo(() => {
    if (!tpTicks || !slTicks || slTicks <= 0) return null;
    return (tpTicks / slTicks).toFixed(2);
  }, [tpTicks, slTicks]);

  // ─── Volume helpers ─────────────────────
  const adjustVolume = useCallback((delta: number) => {
    setVolume((v) => {
      const next = Math.round((v + delta) * 100) / 100;
      return Math.max(spec.minVolume, Math.min(spec.maxVolume, next));
    });
  }, [spec.minVolume, spec.maxVolume]);

  const handleVolumeInput = useCallback((val: string) => {
    if (unitMode === 'lots') {
      const n = parseFloat(val);
      if (!isNaN(n)) setVolume(Math.max(spec.minVolume, Math.min(spec.maxVolume, n)));
    } else {
      const u = parseInt(val, 10);
      if (!isNaN(u)) {
        const lots = Math.round((u / spec.contractSize) * 100) / 100;
        setVolume(Math.max(spec.minVolume, Math.min(spec.maxVolume, lots)));
      }
    }
  }, [unitMode, spec.contractSize, spec.minVolume, spec.maxVolume]);

  // Format price for display
  const fmt = useCallback((price: number) => price.toFixed(spec.digits), [spec.digits]);

  // ─── Submit order ───────────────────────
  const handleSubmit = useCallback(async () => {
    if (!mt5.status.authenticated) {
      setError('Not connected to MT5');
      return;
    }
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const params: {
        symbol: string;
        direction: 'BUY' | 'SELL';
        volume: number;
        price?: number;
        sl?: number;
        tp?: number;
      } = {
        symbol: activeSymbol,
        direction: side,
        volume,
      };

      if (orderType !== 'market' && limitPrice) {
        params.price = parseFloat(limitPrice);
      }
      if (slEnabled && slPrice) params.sl = parseFloat(slPrice);
      if (tpEnabled && tpPrice) params.tp = parseFloat(tpPrice);

      const result = await mt5.placeOrder(params);
      if (result.success) {
        setSuccess(`Order placed: ${side} ${volume} ${activeSymbol}`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(`Order rejected: ${JSON.stringify(result.data?.comment ?? result.data?.retcode ?? 'Unknown')}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setSubmitting(false);
    }
  }, [mt5, activeSymbol, side, volume, orderType, limitPrice, slEnabled, slPrice, tpEnabled, tpPrice]);

  const isAuthenticated = mt5.status.authenticated;
  const hasTick = !!tick;

  return (
    <div className="flex flex-col h-full">
      {/* ─── Order / DOM tabs ─── */}
      <div className="flex border-b border-border">
        <button className="flex-1 py-2 text-xs font-mono font-semibold text-indigo-400 border-b-2 border-indigo-400">
          Order
        </button>
        <button className="flex-1 py-2 text-xs font-mono font-semibold text-muted-foreground" disabled>
          DOM
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* ─── Sell / Spread / Buy price bar ─── */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-0 rounded-lg overflow-hidden">
          {/* Sell side */}
          <button
            onClick={() => setSide('SELL')}
            className={`py-2.5 px-3 text-left transition-all ${
              side === 'SELL'
                ? 'bg-red-500/20 ring-1 ring-red-500/40'
                : 'bg-muted/50 hover:bg-muted'
            }`}
          >
            <div className="text-[10px] font-mono text-red-400/70">Sell</div>
            <div className={`text-sm font-mono font-bold ${side === 'SELL' ? 'text-red-400' : 'text-foreground/60'}`}>
              {hasTick ? fmt(bid) : '—'}
            </div>
          </button>

          {/* Spread badge */}
          <div className="flex items-center justify-center px-2 bg-muted/30 min-w-11">
            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
              {hasTick ? spread : '—'}
            </span>
          </div>

          {/* Buy side */}
          <button
            onClick={() => setSide('BUY')}
            className={`py-2.5 px-3 text-right transition-all ${
              side === 'BUY'
                ? 'bg-blue-500/20 ring-1 ring-blue-500/40'
                : 'bg-muted/50 hover:bg-muted'
            }`}
          >
            <div className="text-[10px] font-mono text-blue-400/70 text-right">Buy</div>
            <div className={`text-sm font-mono font-bold ${side === 'BUY' ? 'text-blue-400' : 'text-foreground/60'}`}>
              {hasTick ? fmt(ask) : '—'}
            </div>
          </button>
        </div>

        {/* ─── Market / Limit / Stop ─── */}
        <div className="grid grid-cols-3 gap-0 bg-muted/30 rounded-lg overflow-hidden">
          {(['market', 'limit', 'stop'] as OrderType[]).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`py-2 text-xs font-mono capitalize transition-all ${
                orderType === t
                  ? 'text-foreground bg-muted border-b-2 border-indigo-400'
                  : 'text-muted-foreground hover:text-foreground/60'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ─── Volume / Units ─── */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <button
              onClick={() => setUnitMode((m) => (m === 'lots' ? 'units' : 'lots'))}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              {unitMode === 'lots' ? 'Lots' : 'Units'} <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <div className="flex items-center h-9 rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => adjustVolume(-spec.volumeStep)}
              className="h-full w-10 flex items-center justify-center text-sm bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors border-r border-border"
            >
              −
            </button>
            <input
              type="text"
              value={unitMode === 'lots' ? volume.toFixed(2) : String(units)}
              onChange={(e) => handleVolumeInput(e.target.value)}
              className="h-full flex-1 min-w-0 bg-card text-foreground text-sm font-mono text-center outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-500/50"
            />
            <button
              onClick={() => adjustVolume(spec.volumeStep)}
              className="h-full w-10 flex items-center justify-center text-sm bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors border-l border-border"
            >
              +
            </button>
          </div>
          {notional > 0 && (
            <div className="text-[10px] font-mono text-muted-foreground mt-1 text-right">
              ≈ {notional.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD
            </div>
          )}
        </div>

        {/* ─── Limit/Stop price input ─── */}
        <AnimatePresence>
          {orderType !== 'market' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <label className="text-[10px] font-mono text-muted-foreground block mb-1">
                {orderType === 'limit' ? 'Limit' : 'Stop'} Price
              </label>
              <input
                type="text"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={entryPrice ? fmt(entryPrice) : 'Price'}
                className="w-full bg-card text-foreground text-sm font-mono px-3 py-2 rounded-lg border border-border outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Exits (TP / SL) ─── */}
        <div className="border border-border rounded-lg">
          {/* Header */}
          <button
            onClick={() => setExitsOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-foreground">Exits</span>
              {rrRatio && (
                <span className="text-[10px] font-mono text-muted-foreground">
                  • Risk/Reward <span className="text-amber-400 font-bold">{rrRatio}</span>
                </span>
              )}
            </div>
            {exitsOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {exitsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="px-3 py-2 space-y-3"
              >
                {/* Take Profit */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Take profit, price <ChevronDown className="h-3 w-3 inline" />
                    </span>
                    <button
                      onClick={() => setTpEnabled((v) => !v)}
                      className={`shrink-0 w-10 h-5.5 rounded-full transition-colors relative ${
                        tpEnabled ? 'bg-blue-500' : 'bg-muted-foreground/30'
                      }`}
                    >
                      <span
                        className={`absolute top-0.75 left-0.75 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                          tpEnabled ? 'translate-x-4.5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      disabled={!tpEnabled}
                      value={tpPrice}
                      onChange={(e) => setTpPrice(e.target.value)}
                      placeholder={entryPrice ? fmt(entryPrice) : '—'}
                      className="flex-1 bg-card text-foreground text-sm font-mono px-3 py-2 rounded-lg border border-border outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap min-w-15 text-right">
                      {tpEnabled && tpTicks ? `${tpTicks.toLocaleString()} Ticks` : ''}
                    </span>
                  </div>
                </div>

                {/* Stop Loss */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Stop loss, price <ChevronDown className="h-3 w-3 inline" />
                    </span>
                    <button
                      onClick={() => setSlEnabled((v) => !v)}
                      className={`shrink-0 w-10 h-5.5 rounded-full transition-colors relative ${
                        slEnabled ? 'bg-blue-500' : 'bg-muted-foreground/30'
                      }`}
                    >
                      <span
                        className={`absolute top-0.75 left-0.75 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                          slEnabled ? 'translate-x-4.5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      disabled={!slEnabled}
                      value={slPrice}
                      onChange={(e) => setSlPrice(e.target.value)}
                      placeholder={entryPrice ? fmt(entryPrice) : '—'}
                      className="flex-1 bg-card text-foreground text-sm font-mono px-3 py-2 rounded-lg border border-border outline-none focus:ring-1 focus:ring-red-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap min-w-15 text-right">
                      {slEnabled && slTicks ? `${slTicks.toLocaleString()} Ticks` : ''}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Order Info ─── */}
        <div className="space-y-1.5 py-2">
          <div className="text-xs font-mono font-semibold text-foreground mb-2">Order info</div>

          {/* Margin */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted-foreground">Margin</span>
            <span className="text-[10px] font-mono text-foreground">
              {marginRequired > 0 ? (
                <>
                  {marginRequired.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {account?.free_margin ? (
                    <span className="text-muted-foreground"> / {account.free_margin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  ) : null}
                </>
              ) : '—'}
            </span>
          </div>

          {/* Margin bar */}
          {account?.free_margin && marginRequired > 0 && (
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  marginRequired / account.free_margin > 0.8 ? 'bg-red-500' :
                  marginRequired / account.free_margin > 0.5 ? 'bg-amber-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, (marginRequired / account.free_margin) * 100)}%` }}
              />
            </div>
          )}

          {/* Leverage */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted-foreground">Leverage</span>
            <span className="text-[10px] font-mono text-foreground font-bold">
              {account?.leverage ? `${account.leverage}:1` : '—'}
            </span>
          </div>

          {/* Tick value */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted-foreground">Tick value</span>
            <span className="text-[10px] font-mono text-foreground">
              {(spec.tickValue * volume).toFixed(2)} USD
            </span>
          </div>
        </div>

        {/* ─── Error / Success ─── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-start gap-2 text-[10px] font-mono text-red-400 bg-red-500/10 rounded-lg p-2"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 rounded-lg p-2"
            >
              ✓ {success}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Action button (pinned to bottom) ─── */}
      <div className="p-3 border-t border-border">
        <motion.button
          onClick={handleSubmit}
          disabled={submitting || !isAuthenticated || !hasTick}
          className={`w-full py-3 rounded-lg text-sm font-mono font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            side === 'BUY'
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-red-600 hover:bg-red-500 text-white'
          }`}
          whileTap={{ scale: 0.98 }}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Placing...
            </span>
          ) : (
            <div className="flex flex-col items-center">
              <span>{side === 'BUY' ? 'Buy' : 'Sell'}</span>
              <span className="text-[10px] opacity-80">
                {unitMode === 'lots' ? volume.toFixed(2) : units.toLocaleString()} {activeSymbol} {orderType.toUpperCase()}
              </span>
            </div>
          )}
        </motion.button>

        {!isAuthenticated && (
          <p className="text-[10px] font-mono text-muted-foreground text-center mt-2">
            Connect to MT5 from the Accounts page to trade
          </p>
        )}
      </div>
    </div>
  );
}
