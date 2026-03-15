-- Performance indexes for MarketDataCandle table
-- Run this AFTER the initial CSV import is complete.
-- Execute via: psql $DATABASE_URL -f prisma/migrations/add_candle_performance_indexes.sql

-- Partial index: only active timeframes needed most (1m, 5m, 15m, 1h)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candle_symbol_res_time_brin
ON "MarketDataCandle" USING BRIN (time)
WHERE resolution IN ('1', '5', '15', '60');

-- Covering index: avoids heap fetch for candle queries (all SELECT columns in index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candle_covering
ON "MarketDataCandle" (symbol, resolution, time ASC)
INCLUDE (open, high, low, close, volume);

-- Drop the id-included default index if the covering index makes it redundant
-- (keep the @@unique constraint index — it enforces correctness)

-- Cluster the table on the covering index for sequential scan performance
-- (run during off-hours — this rewrites the table)
-- CLUSTER "MarketDataCandle" USING idx_candle_covering;

-- Partition suggestion (apply if > 500M rows):
-- Partition by symbol using PARTITION BY LIST (symbol)
-- One partition per symbol: EURUSD, XAUUSD, GBPUSD, etc.

-- Update planner statistics after index creation
ANALYZE "MarketDataCandle";
