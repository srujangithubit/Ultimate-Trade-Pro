/* eslint-disable no-console */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { ReplayEngine } from '../src/backtesting/replay/replay-engine';

interface CandleFrame {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  index: number;
}

interface ReplayRunResult {
  finalBalance: number;
  tradeSequenceHash: string;
  events: TradeEvent[];
  balanceTimeline: BalancePoint[];
}

interface TradeEvent {
  type: string;
  triggerPrice: number;
  candleTime: number;
}

interface BalancePoint {
  index: number;
  candleTime: number;
  balance: number;
}

interface ReplayDeterminismDiffArtifact {
  checked_at: string;
  source: string;
  candles: number;
  dataset_hash: {
    run1: string;
    run2: string;
    mismatch: boolean;
  };
  run1_pnl: number;
  run2_pnl: number;
  pnl_delta: number;
  first_divergence_index: number | null;
  trade_order_mismatch: boolean;
  pnl_divergence_index: number | null;
  run1_trade: TradeEvent | null;
  run2_trade: TradeEvent | null;
  pnl_divergence_point:
    | {
        candle_time: number;
        run1_balance: number;
        run2_balance: number;
      }
    | null;
}

const prisma = new PrismaClient();

function hashJson(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function toCandleFrame(row: {
  time: Date;
  open: unknown;
  high: unknown;
  low: unknown;
  close: unknown;
  volume: unknown;
}, index: number): CandleFrame {
  return {
    time: Math.floor(new Date(row.time).getTime() / 1000),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
    index,
  };
}

function buildSyntheticDataset(count: number): CandleFrame[] {
  const candles: CandleFrame[] = [];
  let base = 1.1;
  let timestamp = Math.floor(Date.now() / 1000) - count * 60;

  for (let i = 0; i < count; i += 1) {
    const drift = Math.sin(i / 20) * 0.0002 + Math.cos(i / 13) * 0.0001;
    const open = base;
    const close = open + drift;
    const high = Math.max(open, close) + 0.00015;
    const low = Math.min(open, close) - 0.00015;

    candles.push({
      time: timestamp,
      open,
      high,
      low,
      close,
      volume: 100 + (i % 40),
      index: i,
    });

    base = close;
    timestamp += 60;
  }

  return candles;
}

async function loadDataset(): Promise<{ candles: CandleFrame[]; source: string }> {
  const symbol = process.env.DETERMINISM_SYMBOL ?? 'EURUSD';
  const resolution = process.env.DETERMINISM_RESOLUTION ?? '1';
  const count = Number(process.env.DETERMINISM_CANDLES ?? '50000');

  const rows = await prisma.marketDataCandle.findMany({
    where: { symbol, resolution },
    orderBy: [{ time: 'desc' }, { id: 'desc' }],
    take: count,
    select: {
      time: true,
      open: true,
      high: true,
      low: true,
      close: true,
      volume: true,
    },
  });

  if (rows.length >= Math.min(1000, count)) {
    const candles = rows.reverse().map(toCandleFrame);
    return { candles, source: `db:${symbol}:${resolution}` };
  }

  const syntheticCount = Math.max(5000, Math.min(50000, count));
  return {
    candles: buildSyntheticDataset(syntheticCount),
    source: 'synthetic:fallback',
  };
}

async function runReplay(candles: CandleFrame[]): Promise<ReplayRunResult> {
  return new Promise((resolve, reject) => {
    const engine = new ReplayEngine(
      {
        sessionId: 'determinism-monitor',
        symbol: 'EURUSD',
        resolution: '1',
        startingBalance: 10000,
      },
      candles,
    );

    const first = candles[0];
    engine.addPosition({
      id: 'determinism-pos-1',
      side: 'buy',
      volume: 1,
      entryPrice: first.close,
      entryTime: first.time,
      sl: first.close - 0.001,
      tp: first.close + 0.0015,
      mae: 0,
      mfe: 0,
      unrealizedPnL: 0,
    });

    const events: TradeEvent[] = [];
    const balanceTimeline: BalancePoint[] = [];

    engine.onUpdate((update) => {
      balanceTimeline.push({
        index: update.candle.index,
        candleTime: update.candle.time,
        balance: update.state.balance,
      });

      for (const trigger of update.triggeredSLTP) {
        events.push({
          type: trigger.type,
          triggerPrice: trigger.triggerPrice,
          candleTime: trigger.candleTime,
        });
      }
    });

    engine.onError((error) => reject(error));
    engine.onComplete((state) => {
      resolve({
        finalBalance: state.balance,
        tradeSequenceHash: hashJson(events),
        events,
        balanceTimeline,
      });
    });

    engine.setSpeed('instant');
    engine.play();
  });
}

function isSameTradeEvent(a: TradeEvent | undefined, b: TradeEvent | undefined): boolean {
  if (!a && !b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return (
    a.type === b.type
    && Math.abs(a.triggerPrice - b.triggerPrice) < 1e-12
    && a.candleTime === b.candleTime
  );
}

function findFirstTradeDivergence(
  run1Events: TradeEvent[],
  run2Events: TradeEvent[],
): number | null {
  const maxLen = Math.max(run1Events.length, run2Events.length);
  for (let i = 0; i < maxLen; i += 1) {
    if (!isSameTradeEvent(run1Events[i], run2Events[i])) {
      return i;
    }
  }

  return null;
}

function findFirstPnlDivergence(
  run1Timeline: BalancePoint[],
  run2Timeline: BalancePoint[],
): number | null {
  const maxLen = Math.max(run1Timeline.length, run2Timeline.length);
  for (let i = 0; i < maxLen; i += 1) {
    const point1 = run1Timeline[i];
    const point2 = run2Timeline[i];

    if (!point1 || !point2) {
      return i;
    }

    if (Math.abs(point1.balance - point2.balance) >= 1e-9) {
      return i;
    }
  }

  return null;
}

function writeDiffArtifact(diff: ReplayDeterminismDiffArtifact): string {
  const artifactDir = path.resolve('artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });

  const artifactPath = path.join(artifactDir, 'replay-determinism-diff.json');
  fs.writeFileSync(artifactPath, JSON.stringify(diff, null, 2), 'utf-8');
  return artifactPath;
}

function applyDeterminismTestModeFault(run2: ReplayRunResult): ReplayRunResult {
  if (process.env.DETERMINISM_TEST_MODE !== 'true') {
    return run2;
  }

  console.warn(
    'DETERMINISM_TEST_MODE=true; injecting synthetic replay mismatch for validation',
  );

  if (run2.events.length > 0) {
    run2.events[0] = {
      ...run2.events[0],
      triggerPrice: run2.events[0].triggerPrice + 0.00001,
    };
  } else {
    run2.finalBalance += 0.01;
    if (run2.balanceTimeline.length > 0) {
      run2.balanceTimeline[0] = {
        ...run2.balanceTimeline[0],
        balance: run2.balanceTimeline[0].balance + 0.01,
      };
    }
  }

  return {
    ...run2,
    tradeSequenceHash: hashJson(run2.events),
  };
}

async function reportResult(payload: {
  deterministic: boolean;
  checkedAt: string;
  datasetHash: string;
  tradeSequenceHash: string;
  pnlRun1: number;
  pnlRun2: number;
}) {
  const configuredUrl = process.env.DETERMINISM_REPORT_URL;
  if (configuredUrl === 'disabled') {
    console.warn('Skipping determinism report: DETERMINISM_REPORT_URL=disabled');
    return;
  }

  const url =
    configuredUrl && configuredUrl.trim().length > 0
      ? configuredUrl
      : 'http://localhost:3000/internal/observability/replay-determinism';
  const key = process.env.MT5_INTERNAL_API_KEY ?? '';

  if (!key || !url) {
    console.warn(
      'Skipping determinism report: MT5_INTERNAL_API_KEY or DETERMINISM_REPORT_URL not set',
    );
    return;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-internal-api-key': key,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Determinism report endpoint failed (${response.status}): ${body}`,
    );
  }
}

async function main() {
  const dataset = await loadDataset();
  const datasetHashRun1 = hashJson(dataset.candles);
  const datasetHashRun2 = hashJson(dataset.candles);

  const run1 = await runReplay(dataset.candles);
  const run2 = applyDeterminismTestModeFault(await runReplay(dataset.candles));

  const datasetHashEqual = datasetHashRun1 === datasetHashRun2;
  const pnlEqual = Math.abs(run1.finalBalance - run2.finalBalance) < 1e-9;
  const sequenceEqual = run1.tradeSequenceHash === run2.tradeSequenceHash;
  const deterministic = datasetHashEqual && pnlEqual && sequenceEqual;

  const checkedAt = new Date().toISOString();
  const resultPayload = {
    deterministic,
    checkedAt,
    datasetHash: datasetHashRun1,
    tradeSequenceHash: run1.tradeSequenceHash,
    pnlRun1: run1.finalBalance,
    pnlRun2: run2.finalBalance,
  };

  await reportResult(resultPayload);

  console.log(
    JSON.stringify(
      {
        source: dataset.source,
        candles: dataset.candles.length,
        deterministic,
        checks: {
          datasetHashIdentical: datasetHashEqual,
          tradeSequenceIdentical: sequenceEqual,
          pnlIdentical: pnlEqual,
          datasetHashRun1,
          datasetHashRun2,
        },
        run1: { finalBalance: run1.finalBalance, tradeSequenceHash: run1.tradeSequenceHash },
        run2: { finalBalance: run2.finalBalance, tradeSequenceHash: run2.tradeSequenceHash },
      },
      null,
      2,
    ),
  );

  if (!deterministic) {
    const firstDivergenceIndex = findFirstTradeDivergence(run1.events, run2.events);
    const firstPnlDivergenceIndex = findFirstPnlDivergence(
      run1.balanceTimeline,
      run2.balanceTimeline,
    );

    const run1PnlPoint =
      firstPnlDivergenceIndex !== null ? run1.balanceTimeline[firstPnlDivergenceIndex] : undefined;
    const run2PnlPoint =
      firstPnlDivergenceIndex !== null ? run2.balanceTimeline[firstPnlDivergenceIndex] : undefined;

    const diffArtifact: ReplayDeterminismDiffArtifact = {
      checked_at: checkedAt,
      source: dataset.source,
      candles: dataset.candles.length,
      dataset_hash: {
        run1: datasetHashRun1,
        run2: datasetHashRun2,
        mismatch: !datasetHashEqual,
      },
      run1_pnl: run1.finalBalance,
      run2_pnl: run2.finalBalance,
      pnl_delta: run2.finalBalance - run1.finalBalance,
      first_divergence_index: firstDivergenceIndex,
      trade_order_mismatch: !sequenceEqual,
      pnl_divergence_index: firstPnlDivergenceIndex,
      run1_trade:
        firstDivergenceIndex !== null ? (run1.events[firstDivergenceIndex] ?? null) : null,
      run2_trade:
        firstDivergenceIndex !== null ? (run2.events[firstDivergenceIndex] ?? null) : null,
      pnl_divergence_point:
        run1PnlPoint && run2PnlPoint
          ? {
              candle_time: run1PnlPoint.candleTime,
              run1_balance: run1PnlPoint.balance,
              run2_balance: run2PnlPoint.balance,
            }
          : null,
    };

    const artifactPath = writeDiffArtifact(diffArtifact);
    console.error(`Replay determinism diff artifact generated at: ${artifactPath}`);
    console.error('Replay determinism failure detected');
    process.exitCode = 1;
  }
}

main()
  .catch((error: Error) => {
    console.error('Replay determinism monitor failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
