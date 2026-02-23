-- ==========================================
-- Seed Data for Development
-- ==========================================

-- Create Default User
INSERT INTO users (id, email, password_hash, display_name, is_verified)
VALUES (
    uuid_generate_v4(),
    'admin@example.com',
    '$2b$10$EpIx.hS.XFp/Z7.Z7.Z7.Z7.Z7.Z7.Z7.Z7.Z7.Z7.Z7.Z7', -- Example bcrypt hash (password: admin123)
    'Admin User',
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- Get User ID (Assuming single user for seed simplicity in next steps, otherwise use specific UUID from above)
DO $$
DECLARE
    v_user_id UUID;
    v_account_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE email = 'admin@example.com';

    -- Create Trading Account
    INSERT INTO trading_accounts (id, user_id, name, broker, balance)
    VALUES (
        uuid_generate_v4(),
        v_user_id,
        'Main Portfolio',
        'paper',
        100000.00
    ) RETURNING id INTO v_account_id;

    -- Create Sample Trades
    INSERT INTO trades (
        user_id, account_id, symbol, direction, entry_date, exit_date,
        entry_price, exit_price, quantity, pnl_gross, pnl_net, status, notes
    ) VALUES
    (
        v_user_id, v_account_id, 'AAPL', 'LONG', NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days',
        150.00, 155.00, 100, 500.00, 495.00, 'CLOSED', 'Sample trade 1 - Winning'
    ),
    (
        v_user_id, v_account_id, 'TSLA', 'SHORT', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 days',
        200.00, 210.00, 50, -500.00, -505.00, 'CLOSED', 'Sample trade 2 - Losing'
    );
    
    -- Refresh Materialized Views
    REFRESH MATERIALIZED VIEW daily_performance_summary;
    REFRESH MATERIALIZED VIEW monthly_performance_summary;

END $$;
