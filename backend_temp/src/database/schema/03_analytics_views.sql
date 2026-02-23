-- ==========================================
-- Analytics Materialized Views
-- ==========================================

-- Daily Performance Summary
-- Aggregates trade results by day for fast charting
CREATE MATERIALIZED VIEW daily_performance_summary AS
SELECT
    user_id,
    account_id,
    DATE(entry_date) AS trade_date,
    COUNT(*) AS total_trades,
    COUNT(*) FILTER (WHERE pnl_net > 0) AS winning_trades,
    COUNT(*) FILTER (WHERE pnl_net <= 0) AS losing_trades,
    SUM(pnl_net) AS daily_pnl,
    SUM(pnl_gross) AS daily_gross_pnl,
    SUM(fees) AS daily_fees,
    AVG(pnl_net) AS avg_trade_pnl,
    MAX(pnl_net) AS max_win,
    MIN(pnl_net) AS max_loss
FROM trades
GROUP BY user_id, account_id, DATE(entry_date);

-- Index for fast retrieval by user and date range
CREATE UNIQUE INDEX idx_daily_perf_user_date ON daily_performance_summary (user_id, account_id, trade_date);

-- Refresh function (can be called by trigger or cron)
CREATE OR REPLACE FUNCTION refresh_daily_performance()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_performance_summary;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Monthly Performance Summary
CREATE MATERIALIZED VIEW monthly_performance_summary AS
SELECT
    user_id,
    account_id,
    DATE_TRUNC('month', entry_date) AS month_start,
    COUNT(*) AS total_trades,
    SUM(pnl_net) AS monthly_pnl,
    (COUNT(*) FILTER (WHERE pnl_net > 0)::DECIMAL / NULLIF(COUNT(*), 0)) * 100 AS win_rate
FROM trades
GROUP BY user_id, account_id, DATE_TRUNC('month', entry_date);

CREATE UNIQUE INDEX idx_monthly_perf_user_date ON monthly_performance_summary (user_id, account_id, month_start);
