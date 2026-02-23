-- Enable TimescaleDB extension (Must be installed on the DB server)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ==========================================
-- Market Data Tables (Hypertables)
-- ==========================================

-- Standard OHLCV data for charting and backtesting
CREATE TABLE market_data_candles (
    time        TIMESTAMPTZ NOT NULL,
    symbol      TEXT        NOT NULL,
    resolution  TEXT        NOT NULL, -- '1m', '5m', '15m', '1h', '4h', '1d'
    open        DECIMAL(18, 8) NOT NULL,
    high        DECIMAL(18, 8) NOT NULL,
    low         DECIMAL(18, 8) NOT NULL,
    close       DECIMAL(18, 8) NOT NULL,
    volume      BIGINT      NOT NULL,
    
    -- Additional data points for advanced analysis
    vwap        DECIMAL(18, 8),
    trades      BIGINT, -- Number of trades in this candle
    
    UNIQUE(time, symbol, resolution)
);

-- Convert to Hypertable partitioned by time
SELECT create_hypertable('market_data_candles', 'time', if_not_exists => TRUE);

-- Indexes for fast retrieval by symbol and time range
CREATE INDEX idx_candles_symbol_time ON market_data_candles (symbol, time DESC);
CREATE INDEX idx_candles_resolution_symbol_time ON market_data_candles (resolution, symbol, time DESC);


-- Tick data for high-precision backtesting (Optional/Advanced)
CREATE TABLE market_data_ticks (
    time        TIMESTAMPTZ NOT NULL,
    symbol      TEXT        NOT NULL,
    price       DECIMAL(18, 8) NOT NULL,
    size        DECIMAL(18, 8) NOT NULL,
    exchange    TEXT,
    condition   TEXT[], -- Trade conditions
    
    -- No unique constraint on time/symbol for ticks as multiple trades can happen at same microsecond
);

-- Convert to Hypertable partitioned by time
SELECT create_hypertable('market_data_ticks', 'time', if_not_exists => TRUE);

-- Compression policy (Example: compress chunks older than 7 days for ticks)
-- ALTER TABLE market_data_ticks SET (
--   timescaledb.compress,
--   timescaledb.compress_segmentby = 'symbol'
-- );
-- SELECT add_compression_policy('market_data_ticks', INTERVAL '7 days');
