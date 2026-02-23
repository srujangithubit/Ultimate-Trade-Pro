-- ============================================
-- DEVELOPMENT SEED DATA
-- ============================================

-- Insert test user
INSERT INTO users (id, email, password_hash, first_name, last_name, subscription_tier, is_email_verified)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'test@example.com', '$2b$12$hashedpassword', 'Test', 'User', 'pro', true),
    ('22222222-2222-2222-2222-222222222222', 'demo@example.com', '$2b$12$hashedpassword', 'Demo', 'User', 'free', true);

-- Insert trading account
INSERT INTO trading_accounts (user_id, account_name, starting_balance, current_balance)
VALUES ('11111111-1111-1111-1111-111111111111', 'Main Trading Account', 10000.00, 10000.00);

-- Insert sample symbols
INSERT INTO symbols (symbol, name, asset_class, exchange, currency)
VALUES 
    ('AAPL', 'Apple Inc.', 'stock', 'NASDAQ', 'USD'),
    ('TSLA', 'Tesla Inc.', 'stock', 'NASDAQ', 'USD'),
    ('EURUSD', 'Euro/US Dollar', 'forex', 'FOREX', 'USD'),
    ('BTCUSD', 'Bitcoin/US Dollar', 'crypto', 'CRYPTO', 'USD');

-- Insert sample historical prices (last 7 days, daily)
INSERT INTO historical_prices (symbol, timestamp, open, high, low, close, volume, timeframe)
SELECT 
    'AAPL',
    generate_series(
        CURRENT_DATE - INTERVAL '7 days',
        CURRENT_DATE,
        INTERVAL '1 day'
    ),
    170.00,
    175.00,
    168.00,
    172.50,
    50000000,
    '1d';

-- Insert sample playbook
INSERT INTO playbooks (id, user_id, name, description, entry_rules, exit_rules)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'Momentum Trading Strategy',
    'Buy on strong upward momentum with volume confirmation',
    '[{"rule": "Price above 20 EMA"}, {"rule": "Volume above average"}]'::jsonb,
    '[{"rule": "Price hits target"}, {"rule": "Trailing stop triggered"}]'::jsonb
);

-- Insert sample trades
INSERT INTO trades (user_id, instrument, asset_class, direction, entry_datetime, exit_datetime, 
                    entry_price, exit_price, quantity, fees, source, pnl_net)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'AAPL', 'stock', 'long', 
     CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '4 days',
     170.00, 175.00, 100, 2.00, 'manual', 498.00),
    
    ('11111111-1111-1111-1111-111111111111', 'TSLA', 'stock', 'long',
     CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '2 days',
     200.00, 195.00, 50, 1.50, 'manual', -251.50);

-- Insert broker configurations
INSERT INTO broker_configurations (broker_name, display_name, auth_type, active)
VALUES 
    ('interactive_brokers', 'Interactive Brokers', 'oauth', true),
    ('td_ameritrade', 'TD Ameritrade', 'oauth', true),
    ('alpaca', 'Alpaca', 'api_key', true);

-- Refresh materialized view
REFRESH MATERIALIZED VIEW daily_performance;
