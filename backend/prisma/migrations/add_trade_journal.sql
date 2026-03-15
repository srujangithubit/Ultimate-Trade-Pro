-- Trade journal storage for Backtesting -> Trade Analysis
CREATE TABLE IF NOT EXISTS trade_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL UNIQUE,
  trade_idea TEXT,
  mistakes TEXT,
  emotion TEXT,
  lessons_learned TEXT,
  execution_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trade_journal_trade_fk
    FOREIGN KEY (trade_id)
    REFERENCES trades(id)
    ON DELETE CASCADE,
  CONSTRAINT trade_journal_execution_score_range
    CHECK (execution_score IS NULL OR (execution_score >= 0 AND execution_score <= 100))
);

CREATE INDEX IF NOT EXISTS trade_journal_updated_at_idx ON trade_journal(updated_at DESC);
