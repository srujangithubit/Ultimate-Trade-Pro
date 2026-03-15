# Phase 4 Observability Stack

This document defines the production-grade observability baseline for the trading/backtesting platform.

## Components

- Prometheus: metrics scraping and alerting
- Grafana: visualization and triage dashboards
- Loki: centralized logs
- Promtail: container log collection
- Tempo: trace storage for OpenTelemetry
- Node Exporter: host/system metrics
- Postgres Exporter: database metrics
- Redis Exporter: Redis metrics

## Services and Ports

- API: http://localhost:3000
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3003
- Loki: http://localhost:3100
- Tempo: http://localhost:3200
- Node Exporter: http://localhost:9100/metrics
- Redis Exporter: http://localhost:9121/metrics
- Postgres Exporter: http://localhost:9187/metrics

## Startup

1. Start full stack:

   docker-compose up -d api postgres redis prometheus grafana loki promtail tempo node-exporter redis-exporter postgres-exporter

2. Validate API metrics endpoint:

   curl http://localhost:3000/metrics

3. Open Grafana:

   - URL: http://localhost:3003
   - User: admin
   - Password: admin

## Backend Metrics Added

### Replay and Backtesting

- replay_runs_total
- replay_duration_seconds
- replay_candles_processed
- replay_failures_total
- backtest_jobs_total
- backtest_job_duration_seconds
- backtest_failures_total
- replay_determinism_status
- replay_determinism_last_check_timestamp_seconds
- replay_determinism_failures_total
- financial_invariant_status
- financial_invariant_failures_total
- financial_invariant_last_check_timestamp_seconds
- financial_invariant_invalid_trade_price_total
- financial_invariant_pnl_mismatch_total
- financial_invariant_lot_precision_violation_total
- financial_invariant_timestamp_violation_total
- financial_invariant_risk_violation_total

### Trading and Risk

- orders_created_total{source}
- orders_rejected_total{reason}
- risk_engine_calculations_total

### Platform and API

- api_requests_total{method,route,status_code}
- api_request_latency_seconds{method,route,status_code}
- api_errors_total{source,type}
- rate_limit_violations_total{channel,event}

### Infra Health

- redis_roundtrip_seconds
- redis_health_up
- database_query_duration_seconds{query}
- database_health_up
- mt5_bridge_connectivity{account_id}
- mt5_heartbeats_total

## OpenTelemetry Tracing

Tracing is disabled by default.

Set these environment variables in backend .env:

- OTEL_ENABLED=true
- OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://tempo:4318/v1/traces

When enabled, traces are auto-instrumented via the Node SDK and exported to Tempo.

## Critical Alerts

Rules are in infrastructure/monitoring/alert-rules.yml.

Implemented alerts include:

- ReplayFailuresDetected
- RedisLatencyHigh
- ApiErrorSpike
- OrderRejectionSpike
- RateLimitViolationsHigh
- ReplayDeterminismFailure
- FinancialInvariantViolation
- HighErrorRate
- HighLatencyP95
- HighLatencyP99

## Recommended Dashboard Panels

- Replay Engine Latency: histogram_quantile(0.95, sum(rate(replay_duration_seconds_bucket[5m])) by (le))
- Backtest Job Duration: histogram_quantile(0.95, sum(rate(backtest_job_duration_seconds_bucket[5m])) by (le))
- Redis Latency: histogram_quantile(0.95, sum(rate(redis_roundtrip_seconds_bucket[5m])) by (le))
- DB Query Time: histogram_quantile(0.95, sum(rate(database_query_duration_seconds_bucket[5m])) by (le))
- Orders Created vs Rejected: sum(increase(orders_created_total[5m])) and sum(increase(orders_rejected_total[5m]))
- API Error Rate: sum(rate(api_errors_total[5m]))
- Rate Limit Violations: sum(increase(rate_limit_violations_total[5m]))
- MT5 Connectivity: avg(mt5_bridge_connectivity)
- Replay Determinism Status: replay_determinism_status

## Replay Determinism Monitor

Determinism monitor script:

- backend/scripts/replay-determinism-monitor.ts

The monitor performs two back-to-back replay runs with identical inputs and validates:

- dataset hash equality
- trade sequence hash equality
- final PnL equality

Forced mismatch validation mode:

- DETERMINISM_TEST_MODE=true
- Behavior: injects a synthetic divergence into run2 so deterministic=false for one test run
- Intended use: validate artifact generation, CI upload, and alert pipeline end-to-end
- Requirement: disable immediately after validation

When determinism fails, the monitor writes a root-cause artifact:

- backend/artifacts/replay-determinism-diff.json

Artifact fields include:

- first divergent trade index and both divergent trade payloads
- trade order mismatch flag
- first PnL divergence index and balances at divergence
- dataset hash mismatch details for run1 vs run2

Results are reported to:

- POST /internal/observability/replay-determinism

Auth header:

- x-internal-api-key: MT5_INTERNAL_API_KEY

## Financial Invariant Monitor

Monitor script:

- backend/scripts/financial-invariant-monitor.ts

Artifact output:

- backend/artifacts/financial-invariant-report.json

Artifact includes:

- aggregate counts per invariant
- sampled violating trade IDs (PnL, lot precision, risk)
- sampled timestamp violation keys (symbol/resolution/current/previous time)
- sampled invalid trade price rows
- remediation_queries: SQL-ready read-only inspection queries scoped to sampled violating IDs/keys
- remediation_templates and parameters: parameterized lookup templates for automation-safe triage
- sql_query_truncated: true when SQL snippets are intentionally trimmed to configured max SQL IDs/keys
- parameters.identifiers_truncated: true when parameter identifier lists are capped for artifact size safety
- artifact_size_limit_bytes: configured soft limit threshold used to evaluate large_violation
- engine_version, dataset_hash, and monitor runtime metadata (hostname, runtime_ms, checked_rows)

Runbook note:

- If sql_query_truncated=true, do not rely on inline SQL alone for complete triage.
- Use remediation_templates with parameters.trade_ids / parameters.timestamp_keys to inspect the full parameter payload captured in the artifact.

Invariants checked:

- invalid trade prices (entry_price <= 0 or exit_price <= 0)
- PnL mismatch beyond tolerance against expected movement formula
- lot precision violations against configured lot step
- candle timestamp ordering/future drift violations
- risk violations above configured max risk percent

Results are reported to:

- POST /internal/observability/financial-invariants

Auth header:

- x-internal-api-key: MT5_INTERNAL_API_KEY

Recommended key env vars:

- FINANCIAL_INVARIANT_REPORT_URL
- FINANCIAL_INVARIANT_TRADE_SAMPLE_LIMIT
- FINANCIAL_INVARIANT_PNL_TOLERANCE
- FINANCIAL_INVARIANT_LOT_STEP
- FINANCIAL_INVARIANT_LOT_TOLERANCE
- FINANCIAL_INVARIANT_MAX_RISK_PERCENT
- FINANCIAL_INVARIANT_TIMESTAMP_FUTURE_TOLERANCE_SECONDS
- FINANCIAL_INVARIANT_MAX_SAMPLE_IDS
- FINANCIAL_INVARIANT_MAX_SAMPLE_TIMESTAMP_KEYS
- FINANCIAL_INVARIANT_MAX_SQL_IDS
- FINANCIAL_INVARIANT_MAX_SQL_TIMESTAMP_KEYS
- FINANCIAL_INVARIANT_MAX_PARAMETER_IDS
- FINANCIAL_INVARIANT_MAX_PARAMETER_TIMESTAMP_KEYS
- FINANCIAL_INVARIANT_ARTIFACT_SOFT_LIMIT_BYTES
- FINANCIAL_INVARIANT_TRUNCATION_TEST_MODE

## Scheduling

Nightly deterministic check:

- GitHub Actions workflow:
   - .github/workflows/replay-determinism-monitor.yml
   - workflow_dispatch input:
      - test_mode=true enables one-shot synthetic mismatch injection
   - On failure, CI uploads:
      - artifact name: replay-determinism-diff
      - path: backend/artifacts/replay-determinism-diff.json

Periodic financial invariant check:

- GitHub Actions workflow:
   - .github/workflows/financial-invariant-monitor.yml
   - schedule: hourly
   - uploads financial-invariant-report artifact on failure

Optional Docker-based scheduler:

- compose service: determinism-monitor
- compose service: financial-invariant-monitor
- launch with profile:
   - docker compose --profile monitoring up -d determinism-monitor
   - docker compose --profile monitoring up -d financial-invariant-monitor

Weekly large-dataset replay:

- npm run replay:large-dataset

## Alert Response Runbook (Determinism Failure)

If ReplayDeterminismFailure fires:

1. Freeze deployments.
2. Capture the failing dataset hash and monitor output payload.
3. Re-run monitor locally against the same dataset and compare trade sequence hash.
4. Diff replay engine and risk logic commits since the last passing check.
5. Validate floating-point behavior and async ordering in replay event flow.
6. Open an incident ticket and only resume deploys after deterministic pass is restored.

## Grafana Determinism Panels

Dashboard panels include:

- Replay Determinism Status
   - replay_determinism_status
- Replay Determinism Failures Total
   - replay_determinism_failures_total
- Seconds Since Last Determinism Check
   - time() - replay_determinism_last_check_timestamp_seconds
- Replay Determinism Failure Trend (24h)
   - increase(replay_determinism_failures_total[24h])

## Grafana Financial Invariant Panels

Dashboard panels include:

- Financial Invariant Status
   - financial_invariant_status
- Financial Invariant Failures Total
   - financial_invariant_failures_total
- Financial Invariant Last Check Age (s)
   - time() - financial_invariant_last_check_timestamp_seconds

## Alert Response Runbook (Financial Invariant Failure)

If FinancialInvariantViolation fires:

1. Freeze trading and backtesting jobs.
2. Capture backend/artifacts/financial-invariant-report.json.
3. Identify violating rows and affected symbols/accounts.
4. Re-run replay checks to determine corruption scope.
5. Apply data fix or rollback migration/change.
6. Resume workloads only after a healthy monitor pass.

## Rollback

If Phase 4 stack affects local/dev stability:

1. Disable traces by setting OTEL_ENABLED=false.
2. Stop observability containers only:

   docker-compose stop prometheus grafana loki promtail tempo node-exporter redis-exporter postgres-exporter

3. Keep API and data services running:

   docker-compose up -d api postgres redis

## Next Recommended Improvement

Add automated invariant remediation helpers:

- Store violating primary keys in a dedicated remediation queue table
- Attach queryable row snapshots to invariant artifacts
- Add one-click SQL playbooks for safe rollback/fix in staging first
- Track mean-time-to-recovery for invariant incidents in Grafana
