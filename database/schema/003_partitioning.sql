-- ============================================
-- TABLE PARTITIONING FOR SCALABILITY
-- ============================================

-- Partition trades table by year
-- First, recreate trades as partitioned table

-- 1. Rename existing table
ALTER TABLE trades RENAME TO trades_old;

-- 2. Create partitioned table
CREATE TABLE trades (
    id UUID DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    account_id UUID,
    source trade_source NOT NULL,
    session_id UUID,
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, entry_datetime)
) PARTITION BY RANGE (entry_datetime);

-- Create partitions for each year
CREATE TABLE trades_2022 PARTITION OF trades
    FOR VALUES FROM ('2022-01-01') TO ('2023-01-01');

CREATE TABLE trades_2023 PARTITION OF trades
    FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');

CREATE TABLE trades_2024 PARTITION OF trades
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE trades_2025 PARTITION OF trades
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE trades_2026 PARTITION OF trades
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Default partition for future dates
CREATE TABLE trades_default PARTITION OF trades DEFAULT;

-- 3. Migrate data from old table (if exists)
-- INSERT INTO trades SELECT * FROM trades_old;
-- DROP TABLE trades_old;

-- 4. Re-add foreign keys and triggers
ALTER TABLE trades ADD CONSTRAINT fk_trades_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE trades ADD CONSTRAINT fk_trades_account 
    FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE SET NULL;
ALTER TABLE trades ADD CONSTRAINT fk_trades_playbook 
    FOREIGN KEY (playbook_id) REFERENCES playbooks(id) ON DELETE SET NULL;

-- 5. Re-create indexes on partitioned table
CREATE INDEX idx_trades_user_date ON trades(user_id, entry_datetime DESC);
CREATE INDEX idx_trades_instrument ON trades(instrument);
CREATE INDEX idx_trades_tags ON trades USING gin(tags);

-- ============================================
-- PARTITION MAINTENANCE
-- ============================================

-- Function to create next year's partition automatically
CREATE OR REPLACE FUNCTION create_next_year_partition()
RETURNS void AS $$
DECLARE
    next_year INTEGER;
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    next_year := EXTRACT(YEAR FROM CURRENT_DATE) + 1;
    partition_name := 'trades_' || next_year;
    start_date := next_year || '-01-01';
    end_date := (next_year + 1) || '-01-01';
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF trades FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
    );
END;
$$ LANGUAGE plpgsql;
