'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Loader2,
  Radar,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Activity,
  Target,
  Crosshair,
  Layers,
  BarChart3,
  CircleDot,
  Zap,
} from 'lucide-react';
import { playbooksApi, Playbook } from '@/lib/api/playbooks';
import {
  setupDetectionApi,
  SetupDetectionResult,
  DetectSetupPayload,
  OhlcCandle,
} from '@/lib/api/setup-detection';

/* ───── Types ───── */

interface BacktestCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface SetupDetectorProps {
  open: boolean;
  onClose: () => void;
  candles: BacktestCandle[];
  symbol: string;
  timeframe: string;
}

type Phase = 'select-playbook' | 'scanning' | 'results';

/* ───── Stage styling ───── */

const STAGE_STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  'Confirmation': {
    bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30',
    icon: <ShieldCheck className="w-5 h-5" />,
  },
  'Entry Zone': {
    bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30',
    icon: <Target className="w-5 h-5" />,
  },
  'Setup Forming': {
    bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30',
    icon: <Activity className="w-5 h-5" />,
  },
  'Early Formation': {
    bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/30',
    icon: <Radar className="w-5 h-5" />,
  },
  'Insufficient Data': {
    bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30',
    icon: <ShieldAlert className="w-5 h-5" />,
  },
  'Error': {
    bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30',
    icon: <AlertTriangle className="w-5 h-5" />,
  },
};

const ALERT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-red-500/15', text: 'text-red-400', label: '🔴 HIGH PRIORITY' },
  watch: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: '🟡 WATCH ALERT' },
  none: { bg: 'bg-zinc-500/10', text: 'text-zinc-500', label: 'No Alert' },
};

const TREND_ICON: Record<string, React.ReactNode> = {
  bullish: <TrendingUp className="w-4 h-4 text-emerald-400" />,
  bearish: <TrendingDown className="w-4 h-4 text-red-400" />,
  ranging: <Minus className="w-4 h-4 text-amber-400" />,
};

/* ───── Helpers ───── */

function CollapsibleSection({ title, icon, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/40 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

/* ───── Main Component ───── */

export function SetupDetector({ open, onClose, candles, symbol, timeframe }: SetupDetectorProps) {
  const [phase, setPhase] = useState<Phase>('select-playbook');
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SetupDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);

  /* Load playbooks when panel opens */
  const loadPlaybooks = useCallback(async () => {
    if (playbooks.length > 0) return;
    setLoading(true);
    try {
      const data = await playbooksApi.getAll();
      setPlaybooks(data);
    } catch {
      setError('Failed to load playbooks');
    } finally {
      setLoading(false);
    }
  }, [playbooks.length]);

  /* Run scan */
  const handleScan = useCallback(async (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
    setPhase('scanning');
    setError(null);

    try {
      // Convert candles to the OHLC format the API expects
      // Use last 100 candles for analysis (enough for structure detection)
      const recentCandles = candles.slice(-100);
      const ohlcData: OhlcCandle[] = recentCandles.map(c => ({
        time: new Date(c.time * 1000).toISOString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 0,
      }));

      const currentPrice = recentCandles.length > 0
        ? recentCandles[recentCandles.length - 1].close
        : 0;

      const payload: DetectSetupPayload = {
        symbol,
        timeframe,
        current_price: currentPrice,
        ohlc_data: ohlcData,
        strategy: {
          name: playbook.name,
          rules: playbook.rules || [],
          tags: playbook.tags || [],
        },
      };

      const data = await setupDetectionApi.scan(payload);
      setResult(data);
      setPhase('results');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      setError(axiosErr?.response?.data?.message || axiosErr?.message || 'Scan failed');
      setPhase('select-playbook');
    }
  }, [candles, symbol, timeframe]);

  /* Reset */
  const handleBack = useCallback(() => {
    setPhase('select-playbook');
    setResult(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    // Delay reset so slide-out animation completes
    setTimeout(() => { setPhase('select-playbook'); setResult(null); setError(null); }, 300);
  }, [onClose]);

  /* Open panel effect */
  if (open && playbooks.length === 0 && !loading) {
    loadPlaybooks();
  }

  /* ─── Render ─── */

  const stageStyle = result ? (STAGE_STYLES[result.setup_stage] || STAGE_STYLES['Error']) : null;
  const alertStyle = result ? (ALERT_STYLES[result.alert_priority] || ALERT_STYLES['none']) : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className="fixed top-0 right-0 h-full w-110 bg-background border-l border-border z-50 flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Radar className="w-5 h-5 text-cyan-400" />
              <h2 className="font-bold text-sm">Setup Detector</h2>
              {result && (
                <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold ${stageStyle?.bg} ${stageStyle?.text} border ${stageStyle?.border}`}>
                  {result.setup_stage}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {phase === 'results' && (
                <button onClick={handleBack} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/40 transition-colors">
                  Rescan
                </button>
              )}
              <button onClick={handleClose} className="p-1.5 rounded hover:bg-muted/40 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* ─── Phase 1: Select Playbook ─── */}
            {phase === 'select-playbook' && (
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Select a playbook strategy to scan current chart data against:
                </p>
                {error && (
                  <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                    {error}
                  </div>
                )}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : playbooks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    No playbooks found. Create one first.
                  </p>
                ) : (
                  playbooks.map(pb => (
                    <button
                      key={pb.id}
                      onClick={() => handleScan(pb)}
                      className="w-full text-left p-3 rounded-lg border border-border/40 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm text-foreground group-hover:text-cyan-400 transition-colors">
                          {pb.name}
                        </span>
                        <Radar className="w-4 h-4 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
                      </div>
                      {pb.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-1.5">{pb.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>{pb.rules?.length || 0} rules</span>
                        {pb.winRate != null && <span>{pb.winRate}% win rate</span>}
                        {pb.totalTrades != null && <span>{pb.totalTrades} trades</span>}
                      </div>
                    </button>
                  ))
                )}
                <div className="text-[10px] text-muted-foreground/60 pt-2 border-t border-border/30">
                  <strong>Info:</strong> Scanner analyzes the last 100 candles of OHLC data against your strategy rules using AI-powered market structure detection.
                </div>
              </div>
            )}

            {/* ─── Phase 2: Scanning ─── */}
            {phase === 'scanning' && (
              <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
                <div className="relative">
                  <Loader2 className="w-16 h-16 animate-spin text-cyan-500/30" />
                  <Radar className="w-8 h-8 text-cyan-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-foreground">Scanning Market Structure</p>
                  <p className="text-xs text-muted-foreground">
                    Analyzing {candles.length > 100 ? 100 : candles.length} candles for <span className="text-cyan-400">{selectedPlaybook?.name}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 pt-1">
                    Detecting swings, impulse moves, Fibonacci levels, and confirmation patterns...
                  </p>
                </div>
              </div>
            )}

            {/* ─── Phase 3: Results ─── */}
            {phase === 'results' && result && (
              <div className="p-4 space-y-4">
                {/* Alert Banner */}
                {result.alert_triggered && alertStyle && (
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`p-3 rounded-lg border ${result.alert_priority === 'high' ? 'border-red-500/30' : 'border-amber-500/30'} ${alertStyle.bg}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className={`w-4 h-4 ${alertStyle.text}`} />
                      <span className={`text-xs font-bold ${alertStyle.text}`}>{alertStyle.label}</span>
                    </div>
                    {result.alert_message && (
                      <p className="text-[11px] text-muted-foreground whitespace-pre-line">{result.alert_message}</p>
                    )}
                  </motion.div>
                )}

                {/* Score Card */}
                <div className={`p-4 rounded-xl border ${stageStyle?.border} ${stageStyle?.bg}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={stageStyle?.text}>{stageStyle?.icon}</span>
                      <span className={`text-lg font-bold ${stageStyle?.text}`}>{result.setup_stage}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-foreground">{result.confidence_score}%</span>
                      <p className="text-[10px] text-muted-foreground">Confidence</p>
                    </div>
                  </div>
                  {/* Confidence bar */}
                  <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${result.confidence_score}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className={`h-full rounded-full ${
                        result.confidence_score >= 90 ? 'bg-emerald-500' :
                        result.confidence_score >= 70 ? 'bg-amber-500' :
                        result.confidence_score >= 40 ? 'bg-blue-500' : 'bg-zinc-500'
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                    <span>{result.symbol} · {result.timeframe}</span>
                    <span>{result.strategy_name}</span>
                  </div>
                </div>

                {/* Confidence Breakdown */}
                {result.confidence_breakdown && (
                  <CollapsibleSection title="Confidence Breakdown" icon={<BarChart3 className="w-3.5 h-3.5" />} defaultOpen>
                    {Object.entries(result.confidence_breakdown).map(([key, satisfied]) => (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${satisfied ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                        <span className={satisfied ? 'text-foreground' : 'text-muted-foreground'}>
                          {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                        <span className={`ml-auto text-[10px] font-medium ${satisfied ? 'text-emerald-400' : 'text-zinc-500'}`}>
                          {satisfied ? '✓' : '—'}
                        </span>
                      </div>
                    ))}
                  </CollapsibleSection>
                )}

                {/* Market Structure */}
                {result.detected_conditions && (
                  <CollapsibleSection title="Market Structure" icon={<Layers className="w-3.5 h-3.5" />} defaultOpen>
                    <InfoRow
                      label="Trend Direction"
                      value={
                        <span className="flex items-center gap-1">
                          {TREND_ICON[result.detected_conditions.trend_direction] || <Minus className="w-3 h-3" />}
                          <span className="capitalize">{result.detected_conditions.trend_direction}</span>
                        </span>
                      }
                    />
                    <InfoRow label="Structure" value={result.detected_conditions.market_structure || '—'} />
                    {result.detected_conditions.structure_events?.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Events</span>
                        <div className="flex flex-wrap gap-1">
                          {result.detected_conditions.structure_events.map((e, i) => (
                            <span key={i} className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {e}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </CollapsibleSection>
                )}

                {/* Impulse & Swing Points */}
                <CollapsibleSection title="Impulse & Swing Points" icon={<Activity className="w-3.5 h-3.5" />}>
                  {result.detected_conditions?.impulse_move_detected ? (
                    <>
                      <InfoRow label="Impulse Detected" value={<span className="text-emerald-400 font-bold">Yes</span>} />
                      <InfoRow label="Origin" value={result.detected_conditions.impulse_swing?.origin?.toFixed(2) || '—'} />
                      <InfoRow label="Termination" value={result.detected_conditions.impulse_swing?.termination?.toFixed(2) || '—'} />
                      <InfoRow label="Direction" value={
                        <span className="capitalize flex items-center gap-1">
                          {TREND_ICON[result.detected_conditions.impulse_swing?.direction] || null}
                          {result.detected_conditions.impulse_swing?.direction}
                        </span>
                      } />
                    </>
                  ) : (
                    <InfoRow label="Impulse Detected" value={<span className="text-zinc-500">No</span>} />
                  )}
                  <div className="border-t border-border/30 pt-2 mt-2 space-y-1">
                    <InfoRow label="Last Swing High" value={result.swing_points?.last_swing_high?.toFixed(2) || '—'} />
                    <InfoRow label="Last Swing Low" value={result.swing_points?.last_swing_low?.toFixed(2) || '—'} />
                    <InfoRow label="Prior Swing High" value={result.swing_points?.prior_swing_high?.toFixed(2) || '—'} />
                    <InfoRow label="Prior Swing Low" value={result.swing_points?.prior_swing_low?.toFixed(2) || '—'} />
                  </div>
                </CollapsibleSection>

                {/* Fibonacci Levels */}
                {result.detected_conditions?.fibonacci_levels && (
                  <CollapsibleSection title="Fibonacci Levels" icon={<Crosshair className="w-3.5 h-3.5" />}>
                    {Object.entries(result.detected_conditions.fibonacci_levels).map(([ratio, price]) => (
                      <div key={ratio} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-mono">{ratio}</span>
                        <span className={`font-mono ${
                          result.detected_conditions.price_at_fibonacci_level === ratio
                            ? 'text-cyan-400 font-bold'
                            : 'text-foreground'
                        }`}>
                          {price != null ? Number(price).toFixed(2) : '—'}
                        </span>
                        {result.detected_conditions.price_at_fibonacci_level === ratio && (
                          <CircleDot className="w-3 h-3 text-cyan-400 ml-1" />
                        )}
                      </div>
                    ))}
                    {result.detected_conditions.key_level_confluence && (
                      <div className="mt-2 px-2 py-1.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-400 font-medium">
                        ⚡ High confluence zone at {result.detected_conditions.confluence_zone?.toFixed(2)}
                      </div>
                    )}
                    {result.detected_conditions.price_at_fibonacci_level && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        Price at <span className="text-cyan-400 font-medium">{result.detected_conditions.price_at_fibonacci_level}</span> level
                      </div>
                    )}
                  </CollapsibleSection>
                )}

                {/* Confirmation */}
                <CollapsibleSection title="Entry Confirmation" icon={<Target className="w-3.5 h-3.5" />}>
                  <InfoRow
                    label="Confirmation Detected"
                    value={
                      result.detected_conditions?.confirmation_candle_detected
                        ? <span className="text-emerald-400 font-bold">Yes</span>
                        : <span className="text-zinc-500">No</span>
                    }
                  />
                  {result.detected_conditions?.confirmation_candle && (
                    <InfoRow label="Pattern" value={result.detected_conditions.confirmation_candle} />
                  )}
                </CollapsibleSection>

                {/* Risk Reference */}
                {result.risk_reference && (
                  <CollapsibleSection title="Risk Reference" icon={<ShieldAlert className="w-3.5 h-3.5" />}>
                    <InfoRow
                      label="Suggested Stop Zone"
                      value={result.risk_reference.suggested_stop_zone ? result.risk_reference.suggested_stop_zone.toFixed(2) : '—'}
                    />
                    <InfoRow
                      label="Invalidation Level"
                      value={result.risk_reference.invalidation_level ? result.risk_reference.invalidation_level.toFixed(2) : '—'}
                    />
                  </CollapsibleSection>
                )}

                {/* Notes */}
                {result.notes && (
                  <div className="text-[11px] text-muted-foreground bg-muted/20 rounded-lg p-3 border border-border/30">
                    <span className="font-bold text-foreground block mb-1">Notes</span>
                    {result.notes}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
