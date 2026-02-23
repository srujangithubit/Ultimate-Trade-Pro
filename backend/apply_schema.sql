ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS backtesting_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES trading_accounts(id),
    name VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'created',
    configuration JSONB NOT NULL,
    "current_time" TIMESTAMP,
    replay_index INT DEFAULT 0,
    candle_cache JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backtesting_user ON backtesting_sessions(user_id, status);

CREATE TABLE IF NOT EXISTS session_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES backtesting_sessions(id) ON DELETE CASCADE,
    snapshot_time TIMESTAMP DEFAULT NOW(),
    simulation_state JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS chart_drawings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES backtesting_sessions(id) ON DELETE CASCADE,
    type VARCHAR NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chart_drawings_session ON chart_drawings(session_id);


