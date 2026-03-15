/* eslint-disable no-console */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PrismaClient } from '@prisma/client';

type NumericLike = number | string | { toString(): string } | null | undefined;

interface FinancialInvariantCounts {
  invalidTradePrice: number;
  pnlMismatch: number;
  lotPrecisionViolation: number;
  timestampViolation: number;
  riskViolation: number;
}

interface InvalidTradePriceSample {
  id: string;
  symbol: string;
  entryPrice: number;
  exitPrice: number | null;
  status: string;
}

interface TimestampViolationSample {
  symbol: string;
  resolution: string;
  currentTime: string;
  previousTime: string;
}

interface SampledIdSummary {
  sampled_ids: string[];
  sample_size: number;
  sample_limit: number;
  total_detected: number;
}

interface SampledTimestampSummary {
  sampled_keys: TimestampViolationSample[];
  sample_size: number;
  sample_limit: number;
  total_detected: number;
}

interface FinancialInvariantViolations {
  invalidTradePriceRows: InvalidTradePriceSample[];
  invalidTradePriceTradeIds: SampledIdSummary;
  pnlMismatchTradeIds: SampledIdSummary;
  lotPrecisionTradeIds: SampledIdSummary;
  timestampViolationKeys: SampledTimestampSummary;
  riskViolationTradeIds: SampledIdSummary;
}

interface ParameterIdentifierSets {
  invalidTradePriceTradeIds: string[];
  pnlMismatchTradeIds: string[];
  lotPrecisionTradeIds: string[];
  riskViolationTradeIds: string[];
  timestampViolationKeys: Array<{ symbol: string; resolution: string; timestamp: string }>;
  identifiersTruncated: boolean;
}

interface FinancialInvariantReport {
  timestamp: number;
  checked_at: string;
  engine_version: string;
  dataset_hash: string;
  healthy: boolean;
  invalid_trade_price: number;
  pnl_mismatch: number;
  lot_precision_violation: number;
  timestamp_violation: number;
  risk_violation: number;
  sampled_trades: number;
  monitor: {
    hostname: string;
    runtime_ms: number;
    checked_rows: number;
  };
  violations: FinancialInvariantViolations;
  remediation_queries: {
    inspect_pnl_mismatches: string;
    inspect_lot_precision: string;
    inspect_invalid_trade_prices: string;
    inspect_timestamp_violation: string;
    truncated: boolean;
  };
  remediation_templates: {
    trade_lookup: string;
    timestamp_lookup: string;
  };
  parameters: {
    trade_ids: string[];
    timestamp_keys: Array<{ symbol: string; resolution: string; timestamp: string }>;
    identifiers_truncated: boolean;
  };
  sql_query_truncated: boolean;
  artifact_size_bytes: number;
  artifact_size_limit_bytes: number;
  large_violation?: boolean;
}

const prisma = new PrismaClient();

function hashJson(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function getEngineVersion(): string {
  const override = process.env.FINANCIAL_INVARIANT_ENGINE_VERSION;
  if (override && override.trim().length > 0) {
    return override.trim();
  }

  const packageVersion = process.env.npm_package_version ?? 'unknown';
  return `financial-invariant-monitor@${packageVersion}`;
}

function sqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function buildInUuidList(ids: string[]): string {
  return ids.map(sqlQuote).join(', ');
}

function buildTimestampTupleList(
  keys: Array<{ symbol: string; resolution: string; timestamp: string }>,
): string {
  return keys
    .map((key) => `(${sqlQuote(key.symbol)}, ${sqlQuote(key.resolution)}, ${sqlQuote(key.timestamp)}::timestamptz)`)
    .join(', ');
}

function summarizeIds(ids: string[], totalDetected: number, sampleLimit: number): SampledIdSummary {
  const sampled = ids.slice(0, sampleLimit);
  return {
    sampled_ids: sampled,
    sample_size: sampled.length,
    sample_limit: sampleLimit,
    total_detected: totalDetected,
  };
}

function summarizeTimestampKeys(
  keys: TimestampViolationSample[],
  totalDetected: number,
  sampleLimit: number,
): SampledTimestampSummary {
  const sampled = keys.slice(0, sampleLimit);
  return {
    sampled_keys: sampled,
    sample_size: sampled.length,
    sample_limit: sampleLimit,
    total_detected: totalDetected,
  };
}

function toTimestampKey(sample: TimestampViolationSample): {
  symbol: string;
  resolution: string;
  timestamp: string;
} {
  return {
    symbol: sample.symbol,
    resolution: sample.resolution,
    timestamp: sample.currentTime,
  };
}

function isTruncationTestMode(): boolean {
  return process.env.FINANCIAL_INVARIANT_TRUNCATION_TEST_MODE === 'true';
}

function syntheticUuid(index: number): string {
  const suffix = index.toString(16).padStart(12, '0').slice(-12);
  return `00000000-0000-4000-8000-${suffix}`;
}

function buildRemediationPayload(
  violations: FinancialInvariantViolations,
  identifiers: ParameterIdentifierSets,
): {
  remediation_queries: FinancialInvariantReport['remediation_queries'];
  remediation_templates: FinancialInvariantReport['remediation_templates'];
  parameters: FinancialInvariantReport['parameters'];
  sql_query_truncated: boolean;
} {
  const maxSqlIds = Number(process.env.FINANCIAL_INVARIANT_MAX_SQL_IDS ?? '25');
  const maxSqlTimestampKeys = Number(process.env.FINANCIAL_INVARIANT_MAX_SQL_TIMESTAMP_KEYS ?? '15');

  const invalidTradeIds = violations.invalidTradePriceTradeIds.sampled_ids;
  const pnlMismatchTradeIds = violations.pnlMismatchTradeIds.sampled_ids;
  const lotPrecisionTradeIds = violations.lotPrecisionTradeIds.sampled_ids;
  const riskViolationTradeIds = violations.riskViolationTradeIds.sampled_ids;

  const parameterTradeIds = Array.from(
    new Set([
      ...identifiers.invalidTradePriceTradeIds,
      ...identifiers.pnlMismatchTradeIds,
      ...identifiers.lotPrecisionTradeIds,
      ...identifiers.riskViolationTradeIds,
    ]),
  );
  const parameterTimestampKeys = identifiers.timestampViolationKeys;

  const sqlPnlIds = pnlMismatchTradeIds.slice(0, maxSqlIds);
  const sqlLotIds = lotPrecisionTradeIds.slice(0, maxSqlIds);
  const sqlInvalidPriceIds = invalidTradeIds.slice(0, maxSqlIds);
  const sqlTimestampKeys = violations.timestampViolationKeys.sampled_keys
    .map(toTimestampKey)
    .slice(0, maxSqlTimestampKeys);

  const sqlQueryTruncated =
    violations.pnlMismatchTradeIds.total_detected > sqlPnlIds.length
    || violations.lotPrecisionTradeIds.total_detected > sqlLotIds.length
    || violations.invalidTradePriceTradeIds.total_detected > sqlInvalidPriceIds.length
    || violations.timestampViolationKeys.total_detected > sqlTimestampKeys.length;

  const remediation_queries = {
    inspect_pnl_mismatches:
      sqlPnlIds.length > 0
        ? `SELECT id, symbol, direction, entry_price, exit_price, quantity, pnl_gross, pnl_net, fees FROM trades WHERE id IN (${buildInUuidList(sqlPnlIds)});`
        : 'SELECT id, symbol, direction, entry_price, exit_price, quantity, pnl_gross, pnl_net, fees FROM trades WHERE FALSE; -- no pnl mismatch rows in sampled set',
    inspect_lot_precision:
      sqlLotIds.length > 0
        ? `SELECT id, symbol, quantity FROM trades WHERE id IN (${buildInUuidList(sqlLotIds)});`
        : 'SELECT id, symbol, quantity FROM trades WHERE FALSE; -- no lot precision violations in sampled set',
    inspect_invalid_trade_prices:
      sqlInvalidPriceIds.length > 0
        ? `SELECT id, symbol, entry_price, exit_price, status FROM trades WHERE id IN (${buildInUuidList(sqlInvalidPriceIds)});`
        : 'SELECT id, symbol, entry_price, exit_price, status FROM trades WHERE FALSE; -- no invalid trade prices in sampled set',
    inspect_timestamp_violation:
      sqlTimestampKeys.length > 0
        ? `SELECT id, symbol, resolution, time, open, high, low, close FROM "MarketDataCandle" WHERE (symbol, resolution, time) IN (${buildTimestampTupleList(sqlTimestampKeys)});`
        : 'SELECT id, symbol, resolution, time, open, high, low, close FROM "MarketDataCandle" WHERE FALSE; -- no timestamp violations in sampled set',
    truncated: sqlQueryTruncated,
  };

  const remediation_templates = {
    trade_lookup: 'SELECT * FROM trades WHERE id = ANY(:trade_ids::uuid[])',
    timestamp_lookup:
      'SELECT * FROM "MarketDataCandle" WHERE symbol = :symbol AND resolution = :resolution AND time = ANY(:timestamps::timestamptz[])',
  };

  const parameters = {
    trade_ids: parameterTradeIds,
    timestamp_keys: parameterTimestampKeys,
    identifiers_truncated: identifiers.identifiersTruncated,
  };

  return {
    remediation_queries,
    remediation_templates,
    parameters,
    sql_query_truncated: sqlQueryTruncated,
  };
}

function toNumber(value: NumericLike): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'object') {
    const parsedObject = Number(value.toString());
    return Number.isFinite(parsedObject) ? parsedObject : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getContractSize(symbol: string): number {
  const normalized = symbol.toUpperCase();
  if (normalized === 'XAUUSD') return 100;
  if (normalized === 'XAGUSD') return 5000;
  if (normalized.includes('BTC') || normalized.includes('XBT') || normalized.includes('ETH')) {
    return 1;
  }

  if (
    normalized.includes('US30')
    || normalized.includes('NAS')
    || normalized.includes('SPX')
    || normalized.includes('US500')
  ) {
    return 1;
  }

  return 100_000;
}

function getDirectionSign(direction: string): number {
  const normalized = direction.toLowerCase();
  if (normalized.includes('sell') || normalized.includes('short') || normalized.includes('bear')) {
    return -1;
  }

  return 1;
}

function readRiskPercentFromCustomMetrics(customMetrics: unknown): number | null {
  if (!customMetrics || typeof customMetrics !== 'object') {
    return null;
  }

  const metrics = customMetrics as Record<string, unknown>;
  const candidates = [
    metrics.riskPercent,
    metrics.risk_pct,
    metrics.risk_percentage,
    metrics.risk,
  ];

  for (const candidate of candidates) {
    const asNumber = toNumber(candidate as NumericLike);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber;
    }
  }

  return null;
}

async function countInvalidTradePrice(): Promise<number> {
  return prisma.trade.count({
    where: {
      OR: [
        { entryPrice: { lte: 0 } },
        { exitPrice: { lte: 0 } },
      ],
    },
  });
}

async function sampleInvalidTradePrice(limit: number): Promise<InvalidTradePriceSample[]> {
  const rows = await prisma.trade.findMany({
    where: {
      OR: [
        { entryPrice: { lte: 0 } },
        { exitPrice: { lte: 0 } },
      ],
    },
    select: {
      id: true,
      symbol: true,
      entryPrice: true,
      exitPrice: true,
      status: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    symbol: row.symbol,
    entryPrice: toNumber(row.entryPrice),
    exitPrice: row.exitPrice !== null ? toNumber(row.exitPrice) : null,
    status: row.status,
  }));
}

async function sampleInvalidTradePriceIds(limit: number): Promise<string[]> {
  const rows = await prisma.trade.findMany({
    where: {
      OR: [
        { entryPrice: { lte: 0 } },
        { exitPrice: { lte: 0 } },
      ],
    },
    select: {
      id: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: limit,
  });

  return rows.map((row) => row.id);
}

async function countTimestampViolations(): Promise<number> {
  const futureToleranceSeconds = Number(
    process.env.FINANCIAL_INVARIANT_TIMESTAMP_FUTURE_TOLERANCE_SECONDS ?? '300',
  );

  const orderingResult = await prisma.$queryRawUnsafe<Array<{ violation_count: number }>>(`
    SELECT COUNT(*)::int AS violation_count
    FROM (
      SELECT
        symbol,
        resolution,
        time,
        LAG(time) OVER (PARTITION BY symbol, resolution ORDER BY time ASC) AS prev_time
      FROM "MarketDataCandle"
    ) ordered
    WHERE prev_time IS NOT NULL AND time < prev_time
  `);

  const futureResult = await prisma.$queryRawUnsafe<Array<{ violation_count: number }>>(`
    SELECT COUNT(*)::int AS violation_count
    FROM "MarketDataCandle"
    WHERE time > NOW() + ($1 || ' seconds')::interval
  `, String(Math.max(0, futureToleranceSeconds)));

  const orderingViolation = toNumber(orderingResult[0]?.violation_count);
  const futureViolation = toNumber(futureResult[0]?.violation_count);

  return orderingViolation + futureViolation;
}

async function sampleTimestampViolations(limit: number): Promise<TimestampViolationSample[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{
    symbol: string;
    resolution: string;
    current_time: Date;
    previous_time: Date;
  }>>(`
    SELECT
      ordered.symbol,
      ordered.resolution,
      ordered.time AS current_time,
      ordered.prev_time AS previous_time
    FROM (
      SELECT
        symbol,
        resolution,
        time,
        LAG(time) OVER (PARTITION BY symbol, resolution ORDER BY time ASC) AS prev_time
      FROM "MarketDataCandle"
    ) ordered
    WHERE ordered.prev_time IS NOT NULL AND ordered.time < ordered.prev_time
    ORDER BY ordered.symbol, ordered.resolution, ordered.time
    LIMIT $1
  `, limit);

  return rows.map((row) => ({
    symbol: row.symbol,
    resolution: row.resolution,
    currentTime: new Date(row.current_time).toISOString(),
    previousTime: new Date(row.previous_time).toISOString(),
  }));
}

async function countTradeMathViolations(): Promise<{
  pnlMismatch: number;
  lotPrecisionViolation: number;
  riskViolation: number;
  sampledTrades: number;
  pnlMismatchTradeIds: string[];
  lotPrecisionTradeIds: string[];
  riskViolationTradeIds: string[];
}> {
  const pnlTolerance = Number(process.env.FINANCIAL_INVARIANT_PNL_TOLERANCE ?? '1.0');
  const lotStep = Number(process.env.FINANCIAL_INVARIANT_LOT_STEP ?? '0.01');
  const lotTolerance = Number(process.env.FINANCIAL_INVARIANT_LOT_TOLERANCE ?? '0.0000001');
  const maxRiskPercent = Number(process.env.FINANCIAL_INVARIANT_MAX_RISK_PERCENT ?? '2.0');
  const tradeSampleLimit = Number(process.env.FINANCIAL_INVARIANT_TRADE_SAMPLE_LIMIT ?? '5000');

  const closedTrades = await prisma.trade.findMany({
    where: {
      exitPrice: { not: null },
      OR: [
        { pnlNet: { not: null } },
        { pnlGross: { not: null } },
      ],
    },
    select: {
      id: true,
      symbol: true,
      direction: true,
      entryPrice: true,
      exitPrice: true,
      quantity: true,
      pnlNet: true,
      pnlGross: true,
      fees: true,
      stopLoss: true,
      customMetrics: true,
      account: {
        select: {
          balance: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: Math.max(1, tradeSampleLimit),
  });

  let pnlMismatch = 0;
  let lotPrecisionViolation = 0;
  let riskViolation = 0;
  const pnlMismatchTradeIds: string[] = [];
  const lotPrecisionTradeIds: string[] = [];
  const riskViolationTradeIds: string[] = [];

  for (const trade of closedTrades) {
    const entry = toNumber(trade.entryPrice);
    const exit = toNumber(trade.exitPrice);
    const quantity = toNumber(trade.quantity);
    const fees = toNumber(trade.fees);

    if (lotStep > 0) {
      const multiple = quantity / lotStep;
      if (Math.abs(multiple - Math.round(multiple)) > lotTolerance) {
        lotPrecisionViolation += 1;
        lotPrecisionTradeIds.push(trade.id);
      }
    }

    const directionSign = getDirectionSign(trade.direction);
    const contractSize = getContractSize(trade.symbol);
    const expectedGross = (exit - entry) * directionSign * quantity * contractSize;

    const realizedPnlNet = trade.pnlNet !== null ? toNumber(trade.pnlNet) : null;
    const realizedPnlGross = trade.pnlGross !== null ? toNumber(trade.pnlGross) : null;

    const expectedFromStored =
      realizedPnlNet !== null
        ? expectedGross - fees
        : expectedGross;

    const actualFromStored = realizedPnlNet ?? realizedPnlGross;
    if (actualFromStored !== null && Math.abs(actualFromStored - expectedFromStored) > pnlTolerance) {
      pnlMismatch += 1;
      pnlMismatchTradeIds.push(trade.id);
    }

    const accountBalance = toNumber(trade.account?.balance);
    if (trade.stopLoss !== null && accountBalance > 0 && entry > 0 && quantity > 0) {
      const stopLoss = toNumber(trade.stopLoss);
      const riskAmount = Math.abs(entry - stopLoss) * quantity * contractSize;
      const riskPercent = (riskAmount / accountBalance) * 100;
      if (riskPercent > maxRiskPercent + 1e-9) {
        riskViolation += 1;
        riskViolationTradeIds.push(trade.id);
      }
    } else {
      const customRiskPercent = readRiskPercentFromCustomMetrics(trade.customMetrics);
      if (customRiskPercent !== null && customRiskPercent > maxRiskPercent + 1e-9) {
        riskViolation += 1;
        riskViolationTradeIds.push(trade.id);
      }
    }
  }

  return {
    pnlMismatch,
    lotPrecisionViolation,
    riskViolation,
    sampledTrades: closedTrades.length,
    pnlMismatchTradeIds,
    lotPrecisionTradeIds,
    riskViolationTradeIds,
  };
}

function writeArtifact(report: FinancialInvariantReport): string {
  const artifactDir = path.resolve('artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });

  const artifactPath = path.join(artifactDir, 'financial-invariant-report.json');
  fs.writeFileSync(artifactPath, JSON.stringify(report, null, 2), 'utf-8');
  return artifactPath;
}

async function reportResult(payload: {
  healthy: boolean;
  checkedAt: string;
  invalidTradePrice: number;
  pnlMismatch: number;
  lotPrecisionViolation: number;
  timestampViolation: number;
  riskViolation: number;
}) {
  const configuredUrl = process.env.FINANCIAL_INVARIANT_REPORT_URL;
  if (configuredUrl === 'disabled') {
    console.warn('Skipping financial invariant report: FINANCIAL_INVARIANT_REPORT_URL=disabled');
    return;
  }

  const url =
    configuredUrl && configuredUrl.trim().length > 0
      ? configuredUrl
      : 'http://localhost:3000/internal/observability/financial-invariants';
  const key = process.env.MT5_INTERNAL_API_KEY ?? '';

  if (!key || !url) {
    console.warn(
      'Skipping financial invariant report: MT5_INTERNAL_API_KEY or FINANCIAL_INVARIANT_REPORT_URL not set',
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
    throw new Error(`Financial invariant report endpoint failed (${response.status}): ${body}`);
  }
}

async function runChecks(): Promise<{
  counts: FinancialInvariantCounts;
  sampledTrades: number;
  checkedRows: number;
  violations: FinancialInvariantViolations;
  identifiers: ParameterIdentifierSets;
}> {
  const sampleIdLimit = Number(process.env.FINANCIAL_INVARIANT_MAX_SAMPLE_IDS ?? '50');
  const sampleTimestampLimit = Number(process.env.FINANCIAL_INVARIANT_MAX_SAMPLE_TIMESTAMP_KEYS ?? '50');
  const maxParameterIds = Number(process.env.FINANCIAL_INVARIANT_MAX_PARAMETER_IDS ?? '500');
  const maxParameterTimestampKeys = Number(
    process.env.FINANCIAL_INVARIANT_MAX_PARAMETER_TIMESTAMP_KEYS ?? '500',
  );

  const [
    invalidTradePrice,
    timestampViolation,
    tradeMath,
    invalidTradePriceSamples,
    invalidTradePriceIds,
    timestampViolationSamples,
    timestampViolationParameterSamples,
    candleRowCount,
  ] = await Promise.all([
    countInvalidTradePrice(),
    countTimestampViolations(),
    countTradeMathViolations(),
    sampleInvalidTradePrice(sampleIdLimit),
    sampleInvalidTradePriceIds(maxParameterIds + 1),
    sampleTimestampViolations(sampleTimestampLimit),
    sampleTimestampViolations(maxParameterTimestampKeys + 1),
    prisma.marketDataCandle.count(),
  ]);

  const invalidTradeParameterIds = invalidTradePriceIds.slice(0, maxParameterIds);
  const pnlParameterIds = tradeMath.pnlMismatchTradeIds.slice(0, maxParameterIds);
  const lotParameterIds = tradeMath.lotPrecisionTradeIds.slice(0, maxParameterIds);
  const riskParameterIds = tradeMath.riskViolationTradeIds.slice(0, maxParameterIds);
  const timestampParameterKeys = timestampViolationParameterSamples
    .map(toTimestampKey)
    .slice(0, maxParameterTimestampKeys);

  const identifiersTruncated =
    invalidTradePriceIds.length > invalidTradeParameterIds.length
    || tradeMath.pnlMismatchTradeIds.length > pnlParameterIds.length
    || tradeMath.lotPrecisionTradeIds.length > lotParameterIds.length
    || tradeMath.riskViolationTradeIds.length > riskParameterIds.length
    || timestampViolationParameterSamples.length > timestampParameterKeys.length;

  const baseResult = {
    counts: {
      invalidTradePrice,
      pnlMismatch: tradeMath.pnlMismatch,
      lotPrecisionViolation: tradeMath.lotPrecisionViolation,
      timestampViolation,
      riskViolation: tradeMath.riskViolation,
    },
    sampledTrades: tradeMath.sampledTrades,
    checkedRows: tradeMath.sampledTrades + candleRowCount,
    violations: {
      invalidTradePriceRows: invalidTradePriceSamples,
      invalidTradePriceTradeIds: summarizeIds(
        invalidTradePriceSamples.map((trade) => trade.id),
        invalidTradePrice,
        sampleIdLimit,
      ),
      pnlMismatchTradeIds: summarizeIds(
        tradeMath.pnlMismatchTradeIds,
        tradeMath.pnlMismatch,
        sampleIdLimit,
      ),
      lotPrecisionTradeIds: summarizeIds(
        tradeMath.lotPrecisionTradeIds,
        tradeMath.lotPrecisionViolation,
        sampleIdLimit,
      ),
      timestampViolationKeys: summarizeTimestampKeys(
        timestampViolationSamples,
        timestampViolation,
        sampleTimestampLimit,
      ),
      riskViolationTradeIds: summarizeIds(
        tradeMath.riskViolationTradeIds,
        tradeMath.riskViolation,
        sampleIdLimit,
      ),
    },
    identifiers: {
      invalidTradePriceTradeIds: invalidTradeParameterIds,
      pnlMismatchTradeIds: pnlParameterIds,
      lotPrecisionTradeIds: lotParameterIds,
      riskViolationTradeIds: riskParameterIds,
      timestampViolationKeys: timestampParameterKeys,
      identifiersTruncated,
    },
  };

  if (!isTruncationTestMode()) {
    return baseResult;
  }

  const syntheticCount = Math.max(
    200,
    sampleIdLimit + 50,
    maxParameterIds + 50,
    Number(process.env.FINANCIAL_INVARIANT_MAX_SQL_IDS ?? '25') + 50,
  );
  const syntheticTimestampCount = Math.max(
    200,
    sampleTimestampLimit + 50,
    maxParameterTimestampKeys + 50,
    Number(process.env.FINANCIAL_INVARIANT_MAX_SQL_TIMESTAMP_KEYS ?? '15') + 50,
  );

  const syntheticIds = Array.from({ length: syntheticCount }, (_, index) => syntheticUuid(index + 1));
  const syntheticTimestampSamples = Array.from({ length: syntheticTimestampCount }, (_, index) => ({
    symbol: `TEST_${index % 3}`,
    resolution: 'M1',
    currentTime: new Date(Date.UTC(2020, 0, 1, 0, 0, index % 60)).toISOString(),
    previousTime: new Date(Date.UTC(2019, 11, 31, 23, 59, index % 60)).toISOString(),
  }));

  return {
    ...baseResult,
    violations: {
      ...baseResult.violations,
      pnlMismatchTradeIds: summarizeIds(syntheticIds, syntheticIds.length, sampleIdLimit),
      lotPrecisionTradeIds: summarizeIds([], 0, sampleIdLimit),
      timestampViolationKeys: summarizeTimestampKeys(
        syntheticTimestampSamples,
        syntheticTimestampSamples.length,
        sampleTimestampLimit,
      ),
      riskViolationTradeIds: summarizeIds([], 0, sampleIdLimit),
    },
    identifiers: {
      ...baseResult.identifiers,
      pnlMismatchTradeIds: syntheticIds.slice(0, maxParameterIds),
      timestampViolationKeys: syntheticTimestampSamples
        .map(toTimestampKey)
        .slice(0, maxParameterTimestampKeys),
      identifiersTruncated: true,
    },
  };
}

async function main() {
  const startTs = Date.now();
  const { counts, sampledTrades, checkedRows, violations, identifiers } = await runChecks();

  const checkedAt = new Date().toISOString();
  const unhealthyCount = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const healthy = unhealthyCount === 0;

  const payload = {
    healthy,
    checkedAt,
    invalidTradePrice: counts.invalidTradePrice,
    pnlMismatch: counts.pnlMismatch,
    lotPrecisionViolation: counts.lotPrecisionViolation,
    timestampViolation: counts.timestampViolation,
    riskViolation: counts.riskViolation,
  };

  await reportResult(payload);

  const remediationPayload = buildRemediationPayload(violations, identifiers);

  const datasetHash = hashJson({
    counts,
    sampledTrades,
    checkedRows,
    violations,
    identifiers,
  });

  const report: FinancialInvariantReport = {
    timestamp: Math.floor(Date.now() / 1000),
    checked_at: checkedAt,
    engine_version: getEngineVersion(),
    dataset_hash: datasetHash,
    healthy,
    invalid_trade_price: counts.invalidTradePrice,
    pnl_mismatch: counts.pnlMismatch,
    lot_precision_violation: counts.lotPrecisionViolation,
    timestamp_violation: counts.timestampViolation,
    risk_violation: counts.riskViolation,
    sampled_trades: sampledTrades,
    monitor: {
      hostname: os.hostname(),
      runtime_ms: Date.now() - startTs,
      checked_rows: checkedRows,
    },
    violations,
    remediation_queries: remediationPayload.remediation_queries,
    remediation_templates: remediationPayload.remediation_templates,
    parameters: remediationPayload.parameters,
    sql_query_truncated: remediationPayload.sql_query_truncated,
    artifact_size_bytes: 0,
    artifact_size_limit_bytes: 0,
  };

  const artifactSoftLimitBytes = Number(process.env.FINANCIAL_INVARIANT_ARTIFACT_SOFT_LIMIT_BYTES ?? '2000000');
  report.artifact_size_limit_bytes = artifactSoftLimitBytes;
  const initialArtifactString = JSON.stringify(report);
  report.artifact_size_bytes = Buffer.byteLength(initialArtifactString, 'utf8');
  if (report.artifact_size_bytes > artifactSoftLimitBytes) {
    report.large_violation = true;
  }

  const artifactPath = writeArtifact(report);

  console.log(
    JSON.stringify(
      {
        ...report,
        artifact_path: artifactPath,
      },
      null,
      2,
    ),
  );

  if (!healthy) {
    console.error(`Financial invariant violations detected. Artifact: ${artifactPath}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error: Error) => {
    console.error('Financial invariant monitor failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
