-- ============================================
-- TRADING PLATFORM DATABASE SCHEMA
-- Version: 1.0.0
-- Database: PostgreSQL 15+
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'team', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'expired', 'past_due');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    subscription_tier subscription_tier DEFAULT 'free',
    subscription_status subscription_status DEFAULT 'active',
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    is_email_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TRADING ACCOUNTS
-- ============================================

CREATE TABLE trading_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50), -- 'paper', 'live', 'demo'
    starting_balance DECIMAL(15, 2),
    current_balance DECIMAL(15, 2),
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- BACKTESTING
-- ============================================

CREATE TYPE session_status AS ENUM ('active', 'paused', 'completed', 'archived');
CREATE TYPE trade_direction AS ENUM ('long', 'short');
CREATE TYPE asset_class AS ENUM ('stock', 'forex', 'crypto', 'futures', 'options', 'index');

CREATE TABLE backtesting_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_name VARCHAR(255) NOT NULL,
    instrument VARCHAR(50) NOT NULL,
    asset_class asset_class NOT NULL,
    starting_balance DECIMAL(15, 2) NOT NULL,
    current_balance DECIMAL(15, 2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    playbook_id UUID, -- Will reference playbooks table
    current_timestamp TIMESTAMP WITH TIME ZONE,
    playback_speed INTEGER DEFAULT 1,
    status session_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE backtesting_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES backtesting_sessions(id) ON DELETE CASCADE,
    entry_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    exit_datetime TIMESTAMP WITH TIME ZONE,
    direction trade_direction NOT NULL,
    entry_price DECIMAL(15, 8) NOT NULL,
    exit_price DECIMAL(15, 8),
    quantity DECIMAL(15, 8) NOT NULL,
    stop_loss DECIMAL(15, 8),
    take_profit DECIMAL(15, 8),
    pnl_gross DECIMAL(15, 2),
    pnl_net DECIMAL(15, 2),
    fees DECIMAL(15, 2) DEFAULT 0,
    commission DECIMAL(15, 2) DEFAULT 0,
    trade_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE backtesting_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES backtesting_sessions(id) ON DELETE CASCADE,
    instrument VARCHAR(50) NOT NULL,
    direction trade_direction NOT NULL,
    quantity DECIMAL(15, 8) NOT NULL,
    entry_price DECIMAL(15, 8) NOT NULL,
    current_price DECIMAL(15, 8),
    unrealized_pnl DECIMAL(15, 2),
    stop_loss DECIMAL(15, 8),
    take_profit DECIMAL(15, 8),
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'closed'
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE session_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES backtesting_sessions(id) ON DELETE CASCADE,
    snapshot_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    account_balance DECIMAL(15, 2) NOT NULL,
    positions JSONB DEFAULT '[]',
    trades_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TRADE JOURNAL
-- ============================================

CREATE TYPE trade_source AS ENUM ('backtest', 'live', 'manual', 'imported');

CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES trading_accounts(id) ON DELETE SET NULL,
    source trade_source NOT NULL,
    session_id UUID REFERENCES backtesting_sessions(id) ON DELETE SET NULL,
    instrument VARCHAR(50) NOT NULL,
    asset_class asset_class NOT NULL,
    direction trade_direction NOT NULL,
    entry_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    exit_datetime TIMESTAMP WITH TIME ZONE,
    entry_price DECIMAL(15, 8) NOT NULL,
    exit_price DECIMAL(15, 8),
    quantity DECIMAL(15, 8) NOT NULL,
    fees DECIMAL(15, 2) DEFAULT 0,
    commission DECIMAL(15, 2) DEFAULT 0,
    pnl_gross DECIMAL(15, 2),
    pnl_net DECIMAL(15, 2),
    pnl_percentage DECIMAL(10, 4),
    stop_loss DECIMAL(15, 8),
    take_profit DECIMAL(15, 8),
    risk_reward_ratio DECIMAL(10, 2),
    trade_duration_minutes INTEGER,
    notes TEXT,
    tags JSONB DEFAULT '[]',
    playbook_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trade_screenshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    s3_key VARCHAR(500),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trade_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag_name VARCHAR(100) NOT NULL,
    tag_category VARCHAR(50), -- 'setup', 'mistake', 'timeframe', 'custom'
    color_code VARCHAR(7),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_tag UNIQUE (user_id, tag_name)
);

-- ============================================
-- PLAYBOOKS
-- ============================================

CREATE TABLE playbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    entry_rules JSONB DEFAULT '[]',
    exit_rules JSONB DEFAULT '[]',
    risk_parameters JSONB DEFAULT '{}',
    instruments JSONB DEFAULT '[]',
    timeframes JSONB DEFAULT '[]',
    market_conditions JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key to backtesting_sessions
ALTER TABLE backtesting_sessions 
ADD CONSTRAINT fk_session_playbook 
FOREIGN KEY (playbook_id) REFERENCES playbooks(id) ON DELETE SET NULL;

-- Add foreign key to trades
ALTER TABLE trades 
ADD CONSTRAINT fk_trade_playbook 
FOREIGN KEY (playbook_id) REFERENCES playbooks(id) ON DELETE SET NULL;

CREATE TABLE playbook_performance (
    playbook_id UUID PRIMARY KEY REFERENCES playbooks(id) ON DELETE CASCADE,
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5, 2),
    avg_pnl DECIMAL(15, 2),
    profit_factor DECIMAL(10, 2),
    max_drawdown DECIMAL(10, 2),
    last_calculated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE playbook_versions (
   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
   playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
   version_number INTEGER NOT NULL,
   changes JSONB DEFAULT '{}',
   created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MARKET DATA (TimescaleDB)
-- ============================================

CREATE TABLE historical_prices (
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    open DECIMAL(15, 8) NOT NULL,
    high DECIMAL(15, 8) NOT NULL,
    low DECIMAL(15, 8) NOT NULL,
    close DECIMAL(15, 8) NOT NULL,
    volume BIGINT,
    timeframe VARCHAR(10) NOT NULL, -- '1m', '5m', '15m', '1h', '4h', '1d'
    PRIMARY KEY (symbol, timestamp, timeframe)
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('historical_prices', 'timestamp', 
    chunk_time_interval => INTERVAL '1 week',
    if_not_exists => TRUE
);

CREATE TABLE tick_data (
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    price DECIMAL(15, 8) NOT NULL,
    volume INTEGER,
    bid DECIMAL(15, 8),
    ask DECIMAL(15, 8),
    PRIMARY KEY (symbol, timestamp)
);

SELECT create_hypertable('tick_data', 'timestamp',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

CREATE TABLE market_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    description TEXT,
    impact VARCHAR(20), -- 'high', 'medium', 'low'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE symbols (
    symbol VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    asset_class asset_class NOT NULL,
    exchange VARCHAR(50),
    currency VARCHAR(3),
    active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- BROKER INTEGRATIONS
-- ============================================

CREATE TABLE broker_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broker_name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    auth_type VARCHAR(50), -- 'oauth', 'api_key', 'credentials'
    api_endpoint TEXT,
    rate_limits JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_broker_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    broker_id UUID NOT NULL REFERENCES broker_configurations(id),
    status VARCHAR(50) DEFAULT 'connected', -- 'connected', 'disconnected', 'error'
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_frequency INTEGER DEFAULT 300, -- seconds
    auto_sync BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE broker_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID UNIQUE NOT NULL REFERENCES user_broker_connections(id) ON DELETE CASCADE,
    credentials_encrypted BYTEA NOT NULL,
    refresh_token_encrypted BYTEA,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE broker_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES user_broker_connections(id) ON DELETE CASCADE,
    sync_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sync_completed_at TIMESTAMP WITH TIME ZONE,
    trades_imported INTEGER DEFAULT 0,
    status VARCHAR(50), -- 'running', 'completed', 'failed'
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'trade_alert', 'broker_sync', 'system'
    title VARCHAR(255) NOT NULL,
    message TEXT,
    read BOOLEAN DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT false,
    notification_types JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE email_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    template_name VARCHAR(100) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    body TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SUBSCRIPTIONS & BILLING
-- ============================================

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    tier subscription_tier NOT NULL,
    status subscription_status NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    stripe_payment_id VARCHAR(255) UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50), -- 'succeeded', 'failed', 'pending'
    payment_method VARCHAR(50),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    stripe_invoice_id VARCHAR(255) UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50),
    invoice_pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usage_tracking (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    backtesting_sessions_count INTEGER DEFAULT 0,
    trades_imported INTEGER DEFAULT 0,
    api_calls_count INTEGER DEFAULT 0,
    storage_used_mb DECIMAL(10, 2) DEFAULT 0,
    PRIMARY KEY (user_id, period_start)
);

-- ============================================
-- ANALYTICS (Materialized View)
-- ============================================

CREATE MATERIALIZED VIEW daily_performance AS
SELECT 
    user_id,
    DATE(entry_datetime) as trade_date,
    COUNT(*) as total_trades,
    SUM(CASE WHEN pnl_net > 0 THEN 1 ELSE 0 END) as winning_trades,
    SUM(CASE WHEN pnl_net < 0 THEN 1 ELSE 0 END) as losing_trades,
    SUM(pnl_net) as daily_pnl,
    AVG(pnl_net) as avg_pnl,
    MAX(pnl_net) as largest_win,
    MIN(pnl_net) as largest_loss,
    CASE 
        WHEN COUNT(*) > 0 THEN 
            (SUM(CASE WHEN pnl_net > 0 THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)::DECIMAL) * 100
        ELSE 0
    END as win_rate
FROM trades
WHERE exit_datetime IS NOT NULL
GROUP BY user_id, DATE(entry_datetime);

CREATE UNIQUE INDEX ON daily_performance(user_id, trade_date);

CREATE TABLE metric_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    metric_name VARCHAR(50) NOT NULL,
    metric_value DECIMAL(15, 4),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- AUDIT & LOGGING
-- ============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trading_accounts_updated_at BEFORE UPDATE ON trading_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backtesting_sessions_updated_at BEFORE UPDATE ON backtesting_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playbooks_updated_at BEFORE UPDATE ON playbooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_broker_connections_updated_at BEFORE UPDATE ON user_broker_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate trade P&L automatically
CREATE OR REPLACE FUNCTION calculate_trade_pnl()
RETURNS TRIGGER AS $$
BEGIN
    -- Only calculate if exit price is set
    IF NEW.exit_price IS NOT NULL THEN
        IF NEW.direction = 'long' THEN
            NEW.pnl_gross = (NEW.exit_price - NEW.entry_price) * NEW.quantity;
        ELSE
            NEW.pnl_gross = (NEW.entry_price - NEW.exit_price) * NEW.quantity;
        END IF;
        
        NEW.pnl_net = NEW.pnl_gross - COALESCE(NEW.fees, 0) - COALESCE(NEW.commission, 0);
        
        IF NEW.entry_price > 0 THEN
            NEW.pnl_percentage = (NEW.pnl_net / (NEW.entry_price * NEW.quantity)) * 100;
        END IF;
        
        IF NEW.exit_datetime IS NOT NULL AND NEW.entry_datetime IS NOT NULL THEN
            NEW.trade_duration_minutes = EXTRACT(EPOCH FROM (NEW.exit_datetime - NEW.entry_datetime)) / 60;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_pnl_before_insert_trades BEFORE INSERT ON trades
    FOR EACH ROW EXECUTE FUNCTION calculate_trade_pnl();

CREATE TRIGGER calculate_pnl_before_update_trades BEFORE UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION calculate_trade_pnl();

CREATE TRIGGER calculate_pnl_before_insert_backtesting_trades BEFORE INSERT ON backtesting_trades
    FOR EACH ROW EXECUTE FUNCTION calculate_trade_pnl();
