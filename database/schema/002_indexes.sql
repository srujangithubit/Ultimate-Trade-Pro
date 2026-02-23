-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- Users & Authentication
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription ON users(subscription_tier, subscription_status);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at) WHERE expires_at > CURRENT_TIMESTAMP;

-- Trading Accounts
CREATE INDEX idx_trading_accounts_user ON trading_accounts(user_id);

-- Backtesting
CREATE INDEX idx_backtesting_sessions_user ON backtesting_sessions(user_id);
CREATE INDEX idx_backtesting_sessions_status ON backtesting_sessions(status) WHERE status IN ('active', 'paused');
CREATE INDEX idx_backtesting_sessions_created ON backtesting_sessions(created_at DESC);

CREATE INDEX idx_backtesting_trades_session ON backtesting_trades(session_id);
CREATE INDEX idx_backtesting_trades_datetime ON backtesting_trades(entry_datetime DESC);

CREATE INDEX idx_backtesting_positions_session ON backtesting_positions(session_id);
CREATE INDEX idx_backtesting_positions_status ON backtesting_positions(status) WHERE status = 'open';

-- Trade Journal (CRITICAL for performance)
CREATE INDEX idx_trades_user_date ON trades(user_id, entry_datetime DESC);
CREATE INDEX idx_trades_user_instrument ON trades(user_id, instrument);
CREATE INDEX idx_trades_instrument ON trades(instrument);
CREATE INDEX idx_trades_account ON trades(account_id, entry_datetime);
CREATE INDEX idx_trades_source ON trades(source);
CREATE INDEX idx_trades_playbook ON trades(playbook_id) WHERE playbook_id IS NOT NULL;
CREATE INDEX idx_trades_asset_class ON trades(asset_class);
CREATE INDEX idx_trades_pnl ON trades(pnl_net) WHERE exit_datetime IS NOT NULL;

-- Full-text search on notes
CREATE INDEX idx_trades_notes_fts ON trades USING gin(to_tsvector('english', notes));

-- GIN index for JSONB tags
CREATE INDEX idx_trades_tags ON trades USING gin(tags);

CREATE INDEX idx_trade_screenshots_trade ON trade_screenshots(trade_id);
CREATE INDEX idx_trade_tags_user ON trade_tags(user_id);

-- Playbooks
CREATE INDEX idx_playbooks_user ON playbooks(user_id);
CREATE INDEX idx_playbooks_public ON playbooks(is_public) WHERE is_public = true;
CREATE INDEX idx_playbooks_created ON playbooks(created_at DESC);

-- Market Data (TimescaleDB automatically creates time-based indexes)
CREATE INDEX idx_historical_prices_symbol ON historical_prices(symbol, timestamp DESC);
CREATE INDEX idx_historical_prices_timeframe ON historical_prices(timeframe, timestamp DESC);
CREATE INDEX idx_symbols_asset_class ON symbols(asset_class) WHERE active = true;

-- Broker Integrations
CREATE INDEX idx_user_broker_connections_user ON user_broker_connections(user_id);
CREATE INDEX idx_user_broker_connections_status ON user_broker_connections(status);
CREATE INDEX idx_broker_sync_logs_connection ON broker_sync_logs(connection_id, sync_started_at DESC);

-- Notifications
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read = false;
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

-- Subscriptions
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

CREATE INDEX idx_payment_history_user ON payment_history(user_id, paid_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX idx_trades_user_date_instrument ON trades(user_id, entry_datetime DESC, instrument);
CREATE INDEX idx_trades_user_playbook_date ON trades(user_id, playbook_id, entry_datetime DESC) WHERE playbook_id IS NOT NULL;

-- Partial indexes for active/recent data
CREATE INDEX idx_trades_recent ON trades(entry_datetime DESC) 
    WHERE entry_datetime > CURRENT_TIMESTAMP - INTERVAL '90 days';

CREATE INDEX idx_sessions_active ON backtesting_sessions(user_id, updated_at DESC)
    WHERE status IN ('active', 'paused');
