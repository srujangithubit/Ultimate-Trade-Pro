-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- Module 1: Users & Authentication
-- ==========================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- Nullable for OAuth users
    display_name VARCHAR(100),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_agent TEXT,
    ip_address VARCHAR(45)
);

CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'dark',
    chart_settings JSONB DEFAULT '{}', -- Saved chart layouts/indicators
    notification_settings JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    plan_tier VARCHAR(20) DEFAULT 'free', -- free, pro, elite
    status VARCHAR(20) DEFAULT 'active',
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- Module 2: Trading Accounts & Backtesting
-- ==========================================

CREATE TABLE trading_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    broker VARCHAR(50), -- 'paper', 'ibkr', 'binance', etc.
    account_type VARCHAR(20) DEFAULT 'live', -- 'live', 'demo', 'backtest'
    currency VARCHAR(3) DEFAULT 'USD',
    balance DECIMAL(18, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE backtesting_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES trading_accounts(id) ON DELETE SET NULL, -- Linked virtual account
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'created', -- 'created', 'running', 'paused', 'completed'
    configuration JSONB NOT NULL, -- { symbol, timeframe, date_range, initial_balance }
    current_time TIMESTAMPTZ, -- Current simulation time
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE session_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES backtesting_sessions(id) ON DELETE CASCADE,
    snapshot_time TIMESTAMPTZ DEFAULT NOW(), -- Real time when snapshot was taken
    simulation_state JSONB NOT NULL -- Full state of engine to resume
);

-- ==========================================
-- Module 3: Trade Journal & Playbooks
-- ==========================================

CREATE TABLE playbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    rules JSONB DEFAULT '[]', -- Array of rules/checklist items
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
    playbook_id UUID REFERENCES playbooks(id) ON DELETE SET NULL,
    backtest_session_id UUID REFERENCES backtesting_sessions(id) ON DELETE CASCADE, -- Null for live trades

    symbol VARCHAR(20) NOT NULL,
    direction VARCHAR(4) NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
    entry_date TIMESTAMPTZ NOT NULL,
    exit_date TIMESTAMPTZ,
    
    entry_price DECIMAL(18, 8) NOT NULL,
    exit_price DECIMAL(18, 8),
    quantity DECIMAL(18, 8) NOT NULL,
    
    pnl_gross DECIMAL(18, 2),
    pnl_net DECIMAL(18, 2),
    fees DECIMAL(18, 2) DEFAULT 0,
    
    status VARCHAR(20) DEFAULT 'OPEN', -- 'OPEN', 'CLOSED', 'CANCELLED'
    
    notes TEXT,
    tags TEXT[], -- Postgres array for simple tagging
    
    custom_metrics JSONB DEFAULT '{}', -- For storing strategy specific metrics like MAE/MFE
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Using a separate table for more complex tagging if needed, but array is often sufficient for simple tags.
-- Sticking to array for simplicity as per plan, but if complex relationships needed, can add table later.

CREATE TABLE trade_screenshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance (Partial list, more to be added in distinct step)
CREATE INDEX idx_trades_user_entry ON trades(user_id, entry_date DESC);
CREATE INDEX idx_trades_account ON trades(account_id);
CREATE INDEX idx_backtesting_sessions_user ON backtesting_sessions(user_id);
