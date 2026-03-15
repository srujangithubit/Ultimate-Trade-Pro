'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import { ArrowLeft, Download, FileText, Pause, Play, RotateCcw, Save } from 'lucide-react';
import { jsPDF } from 'jspdf';
import api from '@/lib/api/client';

type OutcomeFilter = 'all' | 'winners' | 'losers';
type ReplaySpeed = 0.25 | 0.5 | 1 | 2 | 4;
type ReplayScope = 'toExit' | 'fullWindow';
type TradeAnalysisScope = 'all' | 'account' | 'backtest';

interface TradeItem {
  id: string;
  symbol: string;
  direction: string;
  entryPrice: number;
  exitPrice: number | null;
  entryTime: string;
  exitTime: string | null;
  quantity: number;
  pnl: number | null;
  strategy?: string | null;
  tradeSource?: string;
  backtestSessionId?: string | null;
  createdAt: string;
  durationMs: number;
}

interface ReplayCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  index: number;
}

interface TradeJournal {
  tradeIdea?: string | null;
  mistakes?: string | null;
  emotion?: string | null;
  lessonsLearned?: string | null;
  executionScore?: number | null;
}

interface JournalForm {
  tradeIdea: string;
  mistakes: string;
  emotion: string;
  lessonsLearned: string;
  executionScore: number;
}

interface ReplayData {
  trade: {
    id: string;
    symbol: string;
    direction: string;
    entryPrice: number;
    exitPrice: number | null;
    entryTime: string;
    exitTime: string | null;
    quantity: number;
    pnl: number | null;
    strategy?: string | null;
    notes?: string | null;
  };
  candles: ReplayCandle[];
  timeframe: string;
  entryIndex: number;
  exitIndex: number;
  journal: TradeJournal | null;
  quality: {
    profitabilityScore: number;
    executionScore: number;
    journalCompletion: number;
    overallRating: number;
  };
}

function formatDuration(durationMs: number) {
  const totalMinutes = Math.max(0, Math.floor(durationMs / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatDateTime(ts?: string | null) {
  if (!ts) return 'N/A';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString();
}

function computeMovePercent(direction: string, entry: number, exit: number | null) {
  if (!exit || !entry) return 0;
  const raw = ((exit - entry) / entry) * 100;
  const isShort = direction.toUpperCase().includes('SHORT');
  return isShort ? -raw : raw;
}

function csvEscape(value: string | number | null | undefined) {
  const raw = value == null ? '' : String(value);
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function downloadTextFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ScoreRing({ value, label }: { value: number; label: string }) {
  const safe = Math.max(0, Math.min(100, value));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safe / 100);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="70" height="70" viewBox="0 0 70 70" aria-label={label}>
        <circle cx="35" cy="35" r={radius} stroke="rgba(148,163,184,0.25)" strokeWidth="7" fill="none" />
        <circle
          cx="35"
          cy="35"
          r={radius}
          stroke="rgb(14,165,233)"
          strokeWidth="7"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 35 35)"
        />
        <text x="35" y="39" textAnchor="middle" className="fill-foreground text-xs font-semibold">{safe}</text>
      </svg>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

export function TradeAnalysisView({
  scope,
  backHref,
}: {
  scope: TradeAnalysisScope;
  backHref: string;
}) {
  const [outcome, setOutcome] = useState<OutcomeFilter>('all');
  const [strategy, setStrategy] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);

  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const [replayScope, setReplayScope] = useState<ReplayScope>('toExit');
  const [isReplaying, setIsReplaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [journalForm, setJournalForm] = useState<JournalForm>({
    tradeIdea: '',
    mistakes: '',
    emotion: '',
    lessonsLearned: '',
    executionScore: 50,
  });

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const entryLineRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null>(null);
  const exitLineRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null>(null);

  const filters = useMemo(
    () => ({
      scope,
      outcome,
      strategy: strategy.trim() || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    }),
    [scope, outcome, strategy, fromDate, toDate],
  );

  const tradesQuery = useQuery<TradeItem[]>({
    queryKey: ['trade-analysis-trades', filters],
    queryFn: async () => {
      const { data } = await api.get('/backtesting/trade-analysis/trades', { params: filters });
      return data;
    },
  });

  useEffect(() => {
    if (!selectedTradeId && tradesQuery.data && tradesQuery.data.length > 0) {
      setSelectedTradeId(tradesQuery.data[0].id);
    }
  }, [selectedTradeId, tradesQuery.data]);

  const replayQuery = useQuery<ReplayData>({
    queryKey: ['trade-analysis-replay', selectedTradeId],
    enabled: Boolean(selectedTradeId),
    queryFn: async () => {
      const { data } = await api.get(`/backtesting/trade-analysis/trades/${selectedTradeId}/replay`, {
        params: { before: 100, after: 50, limit: 500 },
      });
      return data;
    },
  });

  const saveJournalMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTradeId) return null;
      const { data } = await api.patch(`/backtesting/trade-analysis/trades/${selectedTradeId}/journal`, journalForm);
      return data;
    },
  });

  useEffect(() => {
    const journal = replayQuery.data?.journal;
    if (!journal) {
      setJournalForm({ tradeIdea: '', mistakes: '', emotion: '', lessonsLearned: '', executionScore: 50 });
      return;
    }

    setJournalForm({
      tradeIdea: journal.tradeIdea ?? '',
      mistakes: journal.mistakes ?? '',
      emotion: journal.emotion ?? '',
      lessonsLearned: journal.lessonsLearned ?? '',
      executionScore: journal.executionScore ?? 50,
    });
  }, [replayQuery.data?.journal]);

  const replayTradeId = replayQuery.data?.trade?.id ?? null;
  const replayEntryIndex = replayQuery.data?.entryIndex ?? -1;
  const replayExitIndex = replayQuery.data?.exitIndex ?? -1;

  useEffect(() => {
    const data = replayQuery.data;
    if (!data) return;
    setCurrentIndex(Math.max(0, Math.min(data.entryIndex, data.exitIndex)));
    setIsReplaying(false);
  }, [replayTradeId, replayEntryIndex, replayExitIndex]);

  const initializeChart = useCallback((container: HTMLDivElement) => {
    if (chartRef.current) return;

    const chart = createChart(container, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#94a3b8',
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      grid: {
        vertLines: { color: 'rgba(148,163,184,0.1)' },
        horzLines: { color: 'rgba(148,163,184,0.1)' },
      },
      width: container.clientWidth,
      height: 420,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }

    const ro = new ResizeObserver(() => {
      if (!chartContainerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
    });
    ro.observe(container);
    resizeObserverRef.current = ro;
  }, []);

  const setChartContainer = useCallback((node: HTMLDivElement | null) => {
    chartContainerRef.current = node;
    if (node) {
      initializeChart(node);
    }
  }, [initializeChart]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || !replayTradeId) return;

    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
      entryLineRef.current = null;
      exitLineRef.current = null;
    }

    initializeChart(container);
  }, [initializeChart, replayTradeId]);

  useEffect(() => {
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      seriesRef.current = null;
      entryLineRef.current = null;
      exitLineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    const data = replayQuery.data;
    if (!series || !chart || !data) return;

    const cappedIndex = Math.min(currentIndex, data.candles.length - 1);
    const startIndex = Math.max(0, Math.min(data.entryIndex, data.exitIndex));
    const endIndex = replayScope === 'fullWindow'
      ? Math.max(startIndex, data.candles.length - 1)
      : Math.max(startIndex, data.exitIndex);
    const revealIndex = isReplaying
      ? cappedIndex
      : Math.max(cappedIndex, endIndex);
    const visible = data.candles.slice(0, Math.max(1, revealIndex + 1));

    series.setData(
      visible.map((c) => ({
        time: c.time as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    if (entryLineRef.current) {
      try { series.removePriceLine(entryLineRef.current); } catch {}
      entryLineRef.current = null;
    }
    if (exitLineRef.current) {
      try { series.removePriceLine(exitLineRef.current); } catch {}
      exitLineRef.current = null;
    }

    entryLineRef.current = series.createPriceLine({
      price: data.trade.entryPrice,
      color: '#3b82f6',
      lineWidth: 1,
      lineStyle: 1,
      axisLabelVisible: true,
      title: 'Entry',
    });

    if (data.trade.exitPrice != null) {
      exitLineRef.current = series.createPriceLine({
        price: data.trade.exitPrice,
        color: '#f59e0b',
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: 'Exit',
      });
    }

    const markers: any[] = [];
    if (data.candles[data.entryIndex]) {
      markers.push({
        time: data.candles[data.entryIndex].time,
        position: 'belowBar',
        color: '#22c55e',
        shape: 'arrowUp',
        text: 'Entry',
      });
    }
    if (data.candles[data.exitIndex]) {
      markers.push({
        time: data.candles[data.exitIndex].time,
        position: 'aboveBar',
        color: '#ef4444',
        shape: 'arrowDown',
        text: 'Exit',
      });
    }

    const markerApi = createSeriesMarkers(series as any);
    markerApi.setMarkers(markers);
    chart.timeScale().fitContent();
  }, [currentIndex, isReplaying, replayQuery.data, replayScope]);

  useEffect(() => {
    const data = replayQuery.data;
    if (!isReplaying || !data || data.candles.length === 0) return;

    const endAt = replayScope === 'fullWindow'
      ? Math.max(data.entryIndex, data.candles.length - 1)
      : Math.max(data.entryIndex, data.exitIndex);
    const baseMs = 800;
    const delay = Math.max(40, Math.floor(baseMs / speed));

    const id = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= endAt) {
          setIsReplaying(false);
          return endAt;
        }
        return next;
      });
    }, delay);

    return () => clearInterval(id);
  }, [isReplaying, replayScope, speed, replayQuery.data]);

  const selectedTrade = replayQuery.data?.trade;
  const quality = replayQuery.data?.quality;
  const movePercent = selectedTrade
    ? computeMovePercent(selectedTrade.direction, selectedTrade.entryPrice, selectedTrade.exitPrice)
    : 0;

  const strategies = useMemo(() => {
    const set = new Set<string>();
    (tradesQuery.data ?? []).forEach((t) => {
      if (t.strategy?.trim()) set.add(t.strategy.trim());
    });
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [tradesQuery.data]);

  const replayBounds = useMemo(() => {
    const data = replayQuery.data;
    if (!data) return { startIndex: 0, endIndex: 0 };

    const startIndex = Math.max(0, Math.min(data.entryIndex, data.exitIndex));
    const endIndex = replayScope === 'fullWindow'
      ? Math.max(startIndex, data.candles.length - 1)
      : Math.max(startIndex, data.exitIndex);

    return { startIndex, endIndex };
  }, [replayQuery.data, replayScope]);

  const timeline = useMemo(() => {
    const data = replayQuery.data;
    const total = data?.candles.length ?? 0;
    if (!data || total <= 1) {
      return {
        total,
        entryPct: 0,
        exitPct: 0,
        currentPct: 0,
        spanLeftPct: 0,
        spanWidthPct: 0,
      };
    }

    const denom = total - 1;
    const entryPct = (data.entryIndex / denom) * 100;
    const exitPct = (data.exitIndex / denom) * 100;
    const clampedCurrent = Math.max(0, Math.min(currentIndex, total - 1));
    const currentPct = (clampedCurrent / denom) * 100;
    const spanLeftPct = Math.min(entryPct, exitPct);
    const spanWidthPct = Math.abs(exitPct - entryPct);

    return {
      total,
      entryPct,
      exitPct,
      currentPct,
      spanLeftPct,
      spanWidthPct,
    };
  }, [currentIndex, replayQuery.data]);

  useEffect(() => {
    if (currentIndex > replayBounds.endIndex) {
      setCurrentIndex(replayBounds.endIndex);
      setIsReplaying(false);
    }
  }, [currentIndex, replayBounds.endIndex]);

  const handleReplayStart = () => {
    if (!replayQuery.data) return;
    if (currentIndex >= replayBounds.endIndex) {
      setCurrentIndex(replayBounds.startIndex);
    }
    setIsReplaying(true);
  };

  const handleReset = () => {
    setIsReplaying(false);
    setCurrentIndex(replayBounds.startIndex);
  };

  const handleExportCsv = () => {
    const replay = replayQuery.data;
    if (!selectedTrade || !quality || !replay) return;

    const rows: Array<[string, string, string | number | null | undefined]> = [
      ['Trade', 'ID', selectedTrade.id],
      ['Trade', 'Symbol', selectedTrade.symbol],
      ['Trade', 'Direction', selectedTrade.direction],
      ['Trade', 'Entry Price', selectedTrade.entryPrice],
      ['Trade', 'Exit Price', selectedTrade.exitPrice],
      ['Trade', 'Entry Time', formatDateTime(selectedTrade.entryTime)],
      ['Trade', 'Exit Time', formatDateTime(selectedTrade.exitTime)],
      ['Trade', 'Quantity', selectedTrade.quantity],
      ['Trade', 'PnL', selectedTrade.pnl],
      ['Analysis', 'Move %', `${movePercent.toFixed(2)}%`],
      ['Analysis', 'Timeframe', replay.timeframe],
      ['Analysis', 'Replay Scope', replayScope === 'toExit' ? 'Stop at Exit' : 'Full Window'],
      ['Analysis', 'Entry Candle Index', replay.entryIndex],
      ['Analysis', 'Exit Candle Index', replay.exitIndex],
      ['Analysis', 'Total Candles', replay.candles.length],
      ['Quality', 'Profitability Score', quality.profitabilityScore],
      ['Quality', 'Execution Score', quality.executionScore],
      ['Quality', 'Journal Completion', quality.journalCompletion],
      ['Quality', 'Overall Rating', quality.overallRating],
      ['Journal', 'Trade Idea', journalForm.tradeIdea],
      ['Journal', 'Mistakes', journalForm.mistakes],
      ['Journal', 'Emotion', journalForm.emotion],
      ['Journal', 'Lessons Learned', journalForm.lessonsLearned],
      ['Journal', 'Execution Score', journalForm.executionScore],
    ];

    const header = 'Section,Field,Value';
    const body = rows
      .map((row) => row.map((col) => csvEscape(col)).join(','))
      .join('\n');

    downloadTextFile(
      `${header}\n${body}\n`,
      `trade-analysis-${selectedTrade.id}.csv`,
      'text/csv;charset=utf-8;',
    );
  };

  const handleExportPdf = () => {
    const replay = replayQuery.data;
    if (!selectedTrade || !quality || !replay) return;

    const doc = new jsPDF();
    let y = 14;
    const pageBottom = 282;

    const ensureSpace = (needed = 8) => {
      if (y + needed > pageBottom) {
        doc.addPage();
        y = 14;
      }
    };

    const addSectionTitle = (title: string) => {
      ensureSpace(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(title, 14, y);
      y += 7;
    };

    const addRow = (label: string, value: string | number | null | undefined) => {
      ensureSpace(8);
      const renderedValue = value == null ? 'N/A' : String(value);
      const wrapped = doc.splitTextToSize(renderedValue, 125);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${label}:`, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(wrapped, 62, y);
      y += Math.max(6, wrapped.length * 5);
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Trade Analysis Export', 14, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
    y += 10;

    addSectionTitle('Trade');
    addRow('ID', selectedTrade.id);
    addRow('Symbol', selectedTrade.symbol);
    addRow('Direction', selectedTrade.direction);
    addRow('Entry Price', selectedTrade.entryPrice);
    addRow('Exit Price', selectedTrade.exitPrice);
    addRow('Entry Time', formatDateTime(selectedTrade.entryTime));
    addRow('Exit Time', formatDateTime(selectedTrade.exitTime));
    addRow('Quantity', selectedTrade.quantity);
    addRow('PnL', selectedTrade.pnl);
    addRow('Move %', `${movePercent.toFixed(2)}%`);

    addSectionTitle('Replay + Quality');
    addRow('Timeframe', replay.timeframe);
    addRow('Replay Scope', replayScope === 'toExit' ? 'Stop at Exit' : 'Full Window');
    addRow('Entry Candle Index', replay.entryIndex);
    addRow('Exit Candle Index', replay.exitIndex);
    addRow('Total Candles', replay.candles.length);
    addRow('Profitability Score', quality.profitabilityScore);
    addRow('Execution Score', quality.executionScore);
    addRow('Journal Completion', quality.journalCompletion);
    addRow('Overall Rating', quality.overallRating);

    addSectionTitle('Journal');
    addRow('Trade Idea', journalForm.tradeIdea || 'N/A');
    addRow('Mistakes', journalForm.mistakes || 'N/A');
    addRow('Emotion', journalForm.emotion || 'N/A');
    addRow('Lessons Learned', journalForm.lessonsLearned || 'N/A');
    addRow('Execution Score', journalForm.executionScore);

    doc.save(`trade-analysis-${selectedTrade.id}.pdf`);
  };

  return (
    <div className="h-[calc(100vh-5rem)] flex overflow-hidden bg-background text-foreground">
      <aside className="w-85 shrink-0 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Trade Analysis</h1>
            <Link href={backHref} className="text-xs text-sky-400 hover:text-sky-300 inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              Back
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              className="bg-card border border-border rounded px-2 py-1.5 text-xs"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as OutcomeFilter)}
            >
              <option value="all">All Trades</option>
              <option value="winners">Winners</option>
              <option value="losers">Losers</option>
            </select>
            <select
              className="bg-card border border-border rounded px-2 py-1.5 text-xs"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
            >
              <option value="">All Strategies</option>
              {strategies.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input
              type="date"
              className="bg-card border border-border rounded px-2 py-1.5 text-xs"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <input
              type="date"
              className="bg-card border border-border rounded px-2 py-1.5 text-xs"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-2">
          {tradesQuery.isLoading && <p className="text-xs text-muted-foreground">Loading trades...</p>}
          {(tradesQuery.data ?? []).map((trade) => {
            const selected = trade.id === selectedTradeId;
            const isProfit = (trade.pnl ?? 0) >= 0;
            return (
              <button
                key={trade.id}
                onClick={() => setSelectedTradeId(trade.id)}
                className={`w-full rounded-lg border p-3 text-left transition-smooth ${
                  selected
                    ? 'border-sky-500/55 bg-sky-500/12 shadow-[0_0_0_2px_rgba(0,102,255,0.3),0_14px_30px_rgba(0,102,255,0.3)]'
                    : 'border-border bg-card hover:border-primary/45 hover:bg-accent/55 hover:shadow-[0_0_0_2px_rgba(0,102,255,0.24),0_12px_26px_rgba(0,102,255,0.24)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{trade.symbol}</span>
                    {trade.backtestSessionId ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-400/25">BACKTEST</span>
                    ) : null}
                  </div>
                  <span className={`text-[11px] font-semibold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(trade.pnl ?? 0) >= 0 ? '+' : ''}{(trade.pnl ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <div>{trade.direction} • Qty {trade.quantity}</div>
                  <div>{trade.entryPrice.toFixed(5)} → {(trade.exitPrice ?? 0).toFixed(5)}</div>
                  <div>{formatDuration(trade.durationMs)} • {formatDateTime(trade.entryTime)}</div>
                  {trade.strategy ? <div>Strategy: {trade.strategy}</div> : null}
                </div>
              </button>
            );
          })}
          {!tradesQuery.isLoading && (tradesQuery.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No trades found for current filters.</p>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-4 space-y-4">
        {!selectedTrade || !quality ? (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">Select a trade to begin replay analysis.</div>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto]">
              <div className="card-hover rounded-xl border border-border bg-card p-4 transition-smooth hover:border-primary/45 hover:shadow-[0_0_0_2px_rgba(0,102,255,0.28),0_14px_30px_rgba(0,102,255,0.26)]">
                <h2 className="text-base font-semibold mb-3">Trade Details</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Symbol</p><p>{selectedTrade.symbol}</p></div>
                  <div><p className="text-xs text-muted-foreground">Direction</p><p>{selectedTrade.direction}</p></div>
                  <div><p className="text-xs text-muted-foreground">Entry</p><p>{selectedTrade.entryPrice.toFixed(5)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Exit</p><p>{(selectedTrade.exitPrice ?? 0).toFixed(5)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Quantity</p><p>{selectedTrade.quantity}</p></div>
                  <div><p className="text-xs text-muted-foreground">Move %</p><p className={movePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}>{movePercent.toFixed(2)}%</p></div>
                  <div><p className="text-xs text-muted-foreground">PnL</p><p className={(selectedTrade.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}>{(selectedTrade.pnl ?? 0).toFixed(2)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Duration</p><p>{formatDateTime(selectedTrade.entryTime)} → {formatDateTime(selectedTrade.exitTime)}</p></div>
                </div>
              </div>

              <div className="card-hover flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-smooth hover:border-primary/45 hover:shadow-[0_0_0_2px_rgba(0,102,255,0.28),0_14px_30px_rgba(0,102,255,0.26)]">
                <ScoreRing value={quality.profitabilityScore} label="Profit" />
                <ScoreRing value={quality.executionScore} label="Execution" />
                <ScoreRing value={quality.journalCompletion} label="Journal" />
                <ScoreRing value={quality.overallRating} label="Overall" />
              </div>
            </section>

            <section className="card-hover space-y-3 rounded-xl border border-border bg-card p-3 transition-smooth hover:border-primary/45 hover:shadow-[0_0_0_2px_rgba(0,102,255,0.28),0_16px_32px_rgba(0,102,255,0.28)]">
              <div ref={setChartContainer} className="w-full h-105" />
              <div className="rounded-lg border border-border bg-muted/40 p-2">
                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Entry to Exit Timeline</span>
                  <span>
                    {replayScope === 'toExit' ? 'Default: stop at exit' : 'Full window enabled'}
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-muted">
                  <div
                    className="absolute top-0 h-2 rounded-full bg-sky-500/30"
                    style={{ left: `${timeline.spanLeftPct}%`, width: `${timeline.spanWidthPct}%` }}
                  />
                  <div
                    className="absolute -top-0.5 h-3 w-3 rounded-full border border-background bg-emerald-400"
                    style={{ left: `${timeline.entryPct}%`, transform: 'translateX(-50%)' }}
                    title="Entry"
                  />
                  <div
                    className="absolute -top-0.5 h-3 w-3 rounded-full border border-background bg-amber-400"
                    style={{ left: `${timeline.exitPct}%`, transform: 'translateX(-50%)' }}
                    title="Exit"
                  />
                  <div
                    className="absolute -top-1 h-4 w-4 rounded-full border-2 border-background bg-sky-400"
                    style={{ left: `${timeline.currentPct}%`, transform: 'translateX(-50%)' }}
                    title="Current replay candle"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Entry #{replayQuery.data?.entryIndex ?? 0}</span>
                  <span>Exit #{replayQuery.data?.exitIndex ?? 0}</span>
                  <span>Current #{Math.min(currentIndex, replayBounds.endIndex)}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <button
                  onClick={isReplaying ? () => setIsReplaying(false) : handleReplayStart}
                  className="inline-flex items-center gap-1 rounded bg-sky-700 px-3 py-1.5 text-sm text-white transition-smooth hover:bg-sky-600 hover:shadow-[0_0_0_2px_rgba(0,102,255,0.32),0_14px_34px_rgba(0,102,255,0.42)]"
                >
                  {isReplaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isReplaying ? 'Pause' : 'Replay'}
                </button>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 rounded bg-muted px-3 py-1.5 text-sm transition-smooth hover:border-primary/40 hover:bg-accent hover:shadow-[0_0_0_2px_rgba(0,102,255,0.24),0_10px_24px_rgba(0,102,255,0.22)]"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
                {[0.25, 0.5, 1, 2, 4].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s as ReplaySpeed)}
                    className={`rounded border px-2.5 py-1 text-xs transition-smooth ${speed === s ? 'border-sky-500/45 bg-sky-500/22 text-sky-200 shadow-[0_0_0_2px_rgba(0,102,255,0.24)]' : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground hover:shadow-[0_0_0_2px_rgba(0,102,255,0.22),0_8px_18px_rgba(0,102,255,0.2)]'}`}
                  >
                    {s}x
                  </button>
                ))}
                <button
                  onClick={() => setReplayScope((prev) => (prev === 'toExit' ? 'fullWindow' : 'toExit'))}
                  className={`rounded border px-2.5 py-1 text-xs transition-smooth ${replayScope === 'toExit' ? 'border-amber-500/40 bg-amber-500/20 text-amber-300' : 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'} hover:shadow-[0_0_0_2px_rgba(0,102,255,0.22),0_8px_20px_rgba(0,102,255,0.2)]`}
                  title="Toggle replay end condition"
                >
                  {replayScope === 'toExit' ? 'Stop at Exit' : 'Full Window'}
                </button>
                <button
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1 rounded border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-smooth hover:border-primary/40 hover:text-foreground hover:shadow-[0_0_0_2px_rgba(0,102,255,0.22),0_8px_18px_rgba(0,102,255,0.2)]"
                  title="Export analysis as CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
                <button
                  onClick={handleExportPdf}
                  className="inline-flex items-center gap-1 rounded border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-smooth hover:border-primary/40 hover:text-foreground hover:shadow-[0_0_0_2px_rgba(0,102,255,0.22),0_8px_18px_rgba(0,102,255,0.2)]"
                  title="Export analysis as PDF"
                >
                  <FileText className="w-3.5 h-3.5" />
                  PDF
                </button>
                <span className="text-xs text-muted-foreground ml-auto">
                  Candle {Math.min(currentIndex, replayBounds.endIndex) + 1} / {replayQuery.data?.candles.length ?? 0}
                </span>
              </div>
            </section>

            <section className="card-hover rounded-xl border border-border bg-card p-4 transition-smooth hover:border-primary/45 hover:shadow-[0_0_0_2px_rgba(0,102,255,0.28),0_14px_30px_rgba(0,102,255,0.26)]">
              <h3 className="text-base font-semibold mb-3">Journal</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <textarea
                  className="h-24 bg-muted border border-border rounded p-2 text-sm"
                  placeholder="Trade idea"
                  value={journalForm.tradeIdea}
                  onChange={(e) => setJournalForm((p) => ({ ...p, tradeIdea: e.target.value }))}
                />
                <textarea
                  className="h-24 bg-muted border border-border rounded p-2 text-sm"
                  placeholder="Mistakes"
                  value={journalForm.mistakes}
                  onChange={(e) => setJournalForm((p) => ({ ...p, mistakes: e.target.value }))}
                />
                <textarea
                  className="h-24 bg-muted border border-border rounded p-2 text-sm"
                  placeholder="Emotion"
                  value={journalForm.emotion}
                  onChange={(e) => setJournalForm((p) => ({ ...p, emotion: e.target.value }))}
                />
                <textarea
                  className="h-24 bg-muted border border-border rounded p-2 text-sm"
                  placeholder="Lessons learned"
                  value={journalForm.lessonsLearned}
                  onChange={(e) => setJournalForm((p) => ({ ...p, lessonsLearned: e.target.value }))}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="text-xs text-muted-foreground">Execution Score</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={journalForm.executionScore ?? 50}
                  onChange={(e) => setJournalForm((p) => ({ ...p, executionScore: Number(e.target.value) }))}
                />
                <span className="text-xs">{journalForm.executionScore ?? 50}</span>
                <button
                  onClick={() => saveJournalMutation.mutate()}
                  disabled={saveJournalMutation.isPending}
                  className="ml-auto inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-sm text-white transition-smooth hover:bg-emerald-500 hover:shadow-[0_0_0_2px_rgba(0,102,255,0.24),0_10px_24px_rgba(0,102,255,0.24)] disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  Save Journal Entry
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default function BacktestingTradeAnalysisPage() {
  return <TradeAnalysisView scope="backtest" backHref="/backtesting" />;
}
