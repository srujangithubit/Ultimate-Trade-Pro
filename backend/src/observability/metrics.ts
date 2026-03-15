import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

export const apiRequestsTotal = new Counter({
  name: 'api_requests_total',
  help: 'Total API requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [metricsRegistry],
});

export const apiRequestLatencySeconds = new Histogram({
  name: 'api_request_latency_seconds',
  help: 'API request latency in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

export const replayRunsTotal = new Counter({
  name: 'replay_runs_total',
  help: 'Total replay executions',
  registers: [metricsRegistry],
});

export const replayFailuresTotal = new Counter({
  name: 'replay_failures_total',
  help: 'Total replay execution failures',
  registers: [metricsRegistry],
});

export const replayDurationSeconds = new Histogram({
  name: 'replay_duration_seconds',
  help: 'Replay run duration in seconds',
  labelNames: ['result'],
  buckets: [1, 2, 5, 10, 30, 60, 120, 300, 900],
  registers: [metricsRegistry],
});

export const replayCandlesProcessed = new Counter({
  name: 'replay_candles_processed',
  help: 'Total candles processed by replay engine',
  registers: [metricsRegistry],
});

export const replayDeterminismStatus = new Gauge({
  name: 'replay_determinism_status',
  help: 'Replay determinism check status (1=pass, 0=fail)',
  registers: [metricsRegistry],
});

export const replayDeterminismLastCheckTimestampSeconds = new Gauge({
  name: 'replay_determinism_last_check_timestamp_seconds',
  help: 'Unix timestamp of the most recent replay determinism check',
  registers: [metricsRegistry],
});

export const replayDeterminismFailuresTotal = new Counter({
  name: 'replay_determinism_failures_total',
  help: 'Total replay determinism monitor failures',
  registers: [metricsRegistry],
});

export const financialInvariantStatus = new Gauge({
  name: 'financial_invariant_status',
  help: 'Financial invariant status (1=healthy, 0=violation)',
  registers: [metricsRegistry],
});

export const financialInvariantFailuresTotal = new Counter({
  name: 'financial_invariant_failures_total',
  help: 'Total financial invariant monitor failing checks',
  registers: [metricsRegistry],
});

export const financialInvariantLastCheckTimestampSeconds = new Gauge({
  name: 'financial_invariant_last_check_timestamp_seconds',
  help: 'Unix timestamp of the most recent financial invariant check',
  registers: [metricsRegistry],
});

export const financialInvariantInvalidTradePriceTotal = new Gauge({
  name: 'financial_invariant_invalid_trade_price_total',
  help: 'Current count of trades violating price validity constraints',
  registers: [metricsRegistry],
});

export const financialInvariantPnlMismatchTotal = new Gauge({
  name: 'financial_invariant_pnl_mismatch_total',
  help: 'Current count of trades with PnL mismatch beyond tolerance',
  registers: [metricsRegistry],
});

export const financialInvariantLotPrecisionViolationTotal = new Gauge({
  name: 'financial_invariant_lot_precision_violation_total',
  help: 'Current count of trades violating lot precision constraints',
  registers: [metricsRegistry],
});

export const financialInvariantTimestampViolationTotal = new Gauge({
  name: 'financial_invariant_timestamp_violation_total',
  help: 'Current count of market candle timestamp ordering violations',
  registers: [metricsRegistry],
});

export const financialInvariantRiskViolationTotal = new Gauge({
  name: 'financial_invariant_risk_violation_total',
  help: 'Current count of trades violating configured risk limits',
  registers: [metricsRegistry],
});

export const backtestJobsTotal = new Counter({
  name: 'backtest_jobs_total',
  help: 'Total backtest jobs started',
  registers: [metricsRegistry],
});

export const backtestJobDurationSeconds = new Histogram({
  name: 'backtest_job_duration_seconds',
  help: 'Duration of backtest jobs in seconds',
  labelNames: ['result'],
  buckets: [1, 2, 5, 10, 30, 60, 120, 300, 900],
  registers: [metricsRegistry],
});

export const backtestFailuresTotal = new Counter({
  name: 'backtest_failures_total',
  help: 'Total failed backtest jobs',
  registers: [metricsRegistry],
});

export const ordersCreatedTotal = new Counter({
  name: 'orders_created_total',
  help: 'Total orders created',
  labelNames: ['source'],
  registers: [metricsRegistry],
});

export const ordersRejectedTotal = new Counter({
  name: 'orders_rejected_total',
  help: 'Total orders rejected',
  labelNames: ['reason'],
  registers: [metricsRegistry],
});

export const riskEngineCalculationsTotal = new Counter({
  name: 'risk_engine_calculations_total',
  help: 'Total risk engine calculations performed',
  registers: [metricsRegistry],
});

export const redisRoundtripSeconds = new Histogram({
  name: 'redis_roundtrip_seconds',
  help: 'Redis roundtrip latency in seconds',
  buckets: [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
  registers: [metricsRegistry],
});

export const redisHealthUp = new Gauge({
  name: 'redis_health_up',
  help: 'Redis health status (1=up, 0=down)',
  registers: [metricsRegistry],
});

export const databaseQueryDurationSeconds = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['query'],
  buckets: [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
  registers: [metricsRegistry],
});

export const databaseHealthUp = new Gauge({
  name: 'database_health_up',
  help: 'Database health status (1=up, 0=down)',
  registers: [metricsRegistry],
});

export const mt5BridgeConnectivity = new Gauge({
  name: 'mt5_bridge_connectivity',
  help: 'MT5 bridge connectivity status (1=healthy heartbeat, 0=stale)',
  labelNames: ['account_id'],
  registers: [metricsRegistry],
});

export const mt5HeartbeatsTotal = new Counter({
  name: 'mt5_heartbeats_total',
  help: 'Total MT5 heartbeats received',
  registers: [metricsRegistry],
});

export const apiErrorsTotal = new Counter({
  name: 'api_errors_total',
  help: 'Total API and WS errors observed',
  labelNames: ['source', 'type'],
  registers: [metricsRegistry],
});

export const rateLimitViolationsTotal = new Counter({
  name: 'rate_limit_violations_total',
  help: 'Total rate-limit violations',
  labelNames: ['channel', 'event'],
  registers: [metricsRegistry],
});
