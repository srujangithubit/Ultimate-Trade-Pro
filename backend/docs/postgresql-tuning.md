# PostgreSQL Tuning for Multi-Year M1 Candle Data

## Sizing estimates
- EURUSD M1 2020-2025: ~1,576,800 rows (5 years × 252 trading days × 1440 M1 bars/day × ~86% fill rate)
- XAUUSD M1 2019-2026: ~2,257,920 rows (7 years)
- 5 symbols × 5 years M1: ~8M rows total
- Per-row size: ~180 bytes (with uuid, 8 decimal columns, indexes)
- Total estimated storage: ~1.5GB table + ~2GB indexes = ~3.5GB

## postgresql.conf recommended settings for a 16GB RAM server:
```ini
shared_buffers = 4GB                    # 25% of RAM
effective_cache_size = 12GB             # 75% of RAM
work_mem = 64MB                         # per-sort/hash operation
maintenance_work_mem = 1GB              # for index builds and VACUUM
wal_buffers = 64MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1                  # assuming SSD storage
effective_io_concurrency = 200          # SSD: 200, HDD: 2
max_parallel_workers_per_gather = 4
max_parallel_maintenance_workers = 4
default_statistics_target = 500         # better query plans for time-series
enable_partitionwise_aggregate = on
```

## Index strategy
Primary query pattern: `WHERE symbol = $1 AND resolution = $2 AND time BETWEEN $3 AND $4 ORDER BY time ASC`

The `@@index([symbol, resolution, time])` covering index handles this perfectly. No additional WHERE indexes needed.

## Multi-user backtesting
- Each session loads candles into NestJS memory (not shared cache between sessions)
- For 10 concurrent sessions × 2M candles × 48 bytes = ~960MB RAM — acceptable on 16GB server
- If > 10 concurrent users: implement a shared candle cache keyed by symbol+resolution+dateRange in a separate CandleCache service using an LRU eviction policy (npm: lru-cache)
- Sessions sharing the same symbol+resolution+dateRange should get a reference to the same cached array (not a copy)

## VACUUM strategy
- After bulk import: `VACUUM ANALYZE "MarketDataCandle"`
- Production: autovacuum is sufficient since candle data is append-only (no updates/deletes)
- Weekly: `VACUUM FREEZE` to prevent transaction ID wraparound on large static tables

## TimescaleDB (optional upgrade)
- If row count exceeds 50M, consider converting to TimescaleDB hypertable
- Command: `SELECT create_hypertable('"MarketDataCandle"', 'time', chunk_time_interval => INTERVAL '1 month')`
- Provides automatic chunk-based pruning and parallel chunk queries
- Not needed below 50M rows with the covering index in place

## Query performance benchmarks (expected)
| Query | Rows | Expected time |
|-------|------|--------------|
| 1 month M1 EURUSD | ~31,680 | <100ms |
| 1 year H1 XAUUSD | ~6,264 | <20ms |
| 5 years M1 EURUSD | ~1.5M | <2s (paginated) |
| COUNT for progress bar | any | <50ms |
| DISTINCT symbols | all | <10ms |
