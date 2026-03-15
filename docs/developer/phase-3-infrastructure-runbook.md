# Phase 3 Infrastructure Safety Runbook

## Scope
This runbook covers operational controls added in Phase 3:

- Redis non-blocking key scans
- Distributed replay state metadata
- REST and WebSocket rate limiting
- Strict CORS allow-list behavior

This runbook must not alter Phase 1 security controls or Phase 2 financial logic.

## Environment Variables

Set these in deployment secrets or environment configuration:

- CORS_ORIGIN_ALLOWLIST
  - Comma-separated list of allowed origins.
  - Example: https://tradepro.com,https://staging.tradepro.com
- REDIS_URL
  - Preferred Redis connection string.
  - If set, it takes precedence over REDIS_HOST and REDIS_PORT.
- REPLAY_STATE_TTL
  - Replay state and ownership TTL in seconds for Redis-backed replay metadata.
  - Default: 3600
- RATE_LIMIT_REQUESTS_PER_MINUTE
  - Unified minute-based limit used by REST throttling and WebSocket event limiting.
  - Default: 100

## Replay Ownership Semantics

### Keys and meaning

- backtest:engine-owner:<sessionId>
  - Value: backend instance id (format: processId-randomSuffix)
  - Meaning: which backend currently owns the live replay engine.
- backtest:state:<sessionId>
  - Value: serialized replay state snapshot.
  - Meaning: latest distributed replay state visible across instances.

### Ownership model

- engine_owner = backend_instance_id
- A backend can only start a replay if owner key is empty or already owned by itself.
- On play/pause/updates, state is persisted to Redis with TTL.
- On completion/destroy, ownership is released and state key is cleaned.

### Failover behavior when instance dies

- Owner key expires automatically after REPLAY_STATE_TTL.
- Another instance can then acquire ownership and resume replay control.
- Last known distributed state remains available until TTL expiry.

## Redis KEYS to SCAN policy

Blocking command usage is not allowed in production paths.

- Replaced patterns:
  - KEYS sync:*<id>*
- Current pattern:
  - SCAN cursor MATCH pattern COUNT 200
  - Batch delete via DEL on returned keys

This avoids Redis event-loop blocking under large keyspaces.

## Rate Limit Tuning

### REST limit

- Configured in global NestJS Throttler setup.
- Current source: RATE_LIMIT_REQUESTS_PER_MINUTE.
- Primary file:
  - backend/src/app.module.ts

### WebSocket event limit

- Applied in replay and replication gateways with per-user, per-event sliding windows.
- Current source: RATE_LIMIT_REQUESTS_PER_MINUTE.
- Primary files:
  - backend/src/backtesting/backtesting.gateway.ts
  - backend/src/trade-sync/replication/replication.gateway.ts

## CORS Hardening

### Current behavior

- HTTP and WebSocket CORS use strict allow-list resolution.
- Origin '*' is not allowed in production code paths.
- Source resolution utility:
  - backend/src/common/cors.util.ts

### Configuration

- Set CORS_ORIGIN_ALLOWLIST with explicit origins.
- Keep localhost origins only in development environments.

## Operational Rollback Procedures

### 1) Disable distributed replay state (fallback to local Map)

If Redis metadata causes instability:

1. Temporarily bypass distributed ownership checks and distributed state reads in backtesting service.
2. Keep activeEngines local map as sole engine source.
3. Redeploy backend.

Rollback target file:

- backend/src/backtesting/backtesting.service.ts

### 2) Disable strict CORS (fallback to development allow-list)

If clients are blocked due to incorrect production origin setup:

1. Set CORS_ORIGIN_ALLOWLIST to known development origins.
2. Restart backend and gateway instances.
3. Validate allowed origin handshake from browser and websocket clients.

### 3) Relax rate limits temporarily

If legitimate traffic is being throttled:

1. Increase RATE_LIMIT_REQUESTS_PER_MINUTE.
2. Restart backend services.
3. Monitor error rates and request burst patterns.

## Validation Checklist

After deployment:

1. Confirm Redis connection is using REDIS_URL in logs or config output.
2. Confirm no Redis KEYS command is present in runtime code paths.
3. Confirm CORS rejects unknown origins and allows configured origins.
4. Confirm REST throttling returns 429 after configured threshold.
5. Confirm WebSocket gateways emit rate-limit errors after threshold.
6. Confirm replay ownership key is created and released as expected.

## Optional Phase 4 (Institution-grade reliability)

Recommended enhancements:

- Observability:
  - Prometheus metrics, OpenTelemetry traces, structured logs
  - Track replay latency, execution latency, Redis round-trip time
- Backtesting audit logs:
  - Persist strategy parameters, dataset hash, engine version, timestamp
- Replay dataset hashing:
  - dataset_hash = sha256(candle_set)
  - Store alongside replay outputs for data-integrity and reproducibility guarantees
