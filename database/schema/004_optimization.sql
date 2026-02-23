-- ============================================
-- PERFORMANCE OPTIMIZATION
-- ============================================

-- Analyze tables for query planner
ANALYZE users;
ANALYZE trades;
ANALYZE backtesting_sessions;
ANALYZE historical_prices;

-- Set autovacuum parameters for high-traffic tables
ALTER TABLE trades SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE historical_prices SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

-- Create statistics for better query planning
CREATE STATISTICS trades_user_instrument_stats ON user_id, instrument FROM trades;
CREATE STATISTICS trades_user_date_stats ON user_id, entry_datetime FROM trades;

-- TimescaleDB compression (for old data)
ALTER TABLE historical_prices SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol, timeframe',
    timescaledb.compress_orderby = 'timestamp DESC'
);

-- Compress chunks older than 6 months
SELECT add_compression_policy('historical_prices', INTERVAL '6 months');

-- Data retention policy (optional - keep last 10 years)
SELECT add_retention_policy('historical_prices', INTERVAL '10 years');
