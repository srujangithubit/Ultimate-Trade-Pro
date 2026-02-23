-- ==========================================
-- Performance Indexes
-- ==========================================

-- Trades Table Optimization
-- Often queried by user + date (dashboard/journal)
CREATE INDEX idx_trades_user_entry_desc ON trades (user_id, entry_date DESC);

-- Often queried by symbol (finding specific trades)
CREATE INDEX idx_trades_symbol ON trades (symbol);

-- Often queried by account + date (per account performance)
CREATE INDEX idx_trades_account_entry_desc ON trades (account_id, entry_date DESC);

-- Full-Text Search on Notes
-- Using GIN index for fast text search
CREATE INDEX idx_trades_notes_fts ON trades USING gin(to_tsvector('english', notes));

-- Backtesting Sessions Optimization
-- Find active sessions quickly
CREATE INDEX idx_sessions_user_status ON backtesting_sessions (user_id, status);

-- User Sessions Optimization
-- Validate sessions by token hash
CREATE INDEX idx_user_sessions_token ON user_sessions (refresh_token_hash);

-- Market Data Hypertables already have time/symbol indexes due to being hypertables,
-- but adding specific ones for common queries if not covered by primary keys.
-- (TimescaleDB usually handles this well with the chunk structure)
