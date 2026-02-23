-- ==========================================
-- Database Security Policies (RLS)
-- ==========================================

-- Enable Role-Based Access Control (RBAC) preparation
-- Users should only see their own data

-- Enable RLS on core tables
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtesting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;

-- Create Policies
-- Assumes the application sets a configuration parameter 'app.current_user_id'
-- efficiently during connection session or transaction.

-- Trades Policy
CREATE POLICY trades_user_isolation ON trades
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Accounts Policy
CREATE POLICY accounts_user_isolation ON trading_accounts
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Backtesting Policy
CREATE POLICY backtesting_user_isolation ON backtesting_sessions
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Playbooks Policy
CREATE POLICY playbooks_user_isolation ON playbooks
    USING (user_id = current_setting('app.current_user_id')::UUID);
    
-- Note: Requires application middleware to set 'app.current_user_id'
-- e.g., SET LOCAL app.current_user_id = 'user-uuid';
