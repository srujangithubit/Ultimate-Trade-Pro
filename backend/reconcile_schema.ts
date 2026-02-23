import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking users table ---');
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR;`);
        console.log('Ensured password_hash exists in users.');
        await prisma.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR;`);
        console.log('Ensured display_name exists in users.');
        await prisma.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;`);
        console.log('Ensured is_verified exists in users.');
    } catch (error) {
        console.error('Error:', error);
    }

    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE trading_accounts ADD CONSTRAINT fk_trading_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;`);
        console.log('Added FK to trading_accounts');
    } catch (e: any) {
        console.log('FK might exist in trading_accounts:', e.message);
    }

    try {
        // 2. Create backtesting_sessions
        await prisma.$executeRawUnsafe(`
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
        `);
        console.log('Ensured backtesting_sessions exists.');

        // 3. Create session_snapshots
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS session_snapshots (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id UUID NOT NULL REFERENCES backtesting_sessions(id) ON DELETE CASCADE,
                snapshot_time TIMESTAMP DEFAULT NOW(),
                simulation_state JSONB NOT NULL
            );
        `);
        console.log('Ensured session_snapshots exists.');

        // 4. Create chart_drawings
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS chart_drawings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id UUID NOT NULL REFERENCES backtesting_sessions(id) ON DELETE CASCADE,
                type VARCHAR NOT NULL,
                data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('Ensured chart_drawings exists.');

        // 5. Create trades
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS trades (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                account_id UUID REFERENCES trading_accounts(id) ON DELETE CASCADE,
                playbook_id UUID,
                backtest_session_id UUID,
                symbol VARCHAR NOT NULL,
                direction VARCHAR NOT NULL,
                setup VARCHAR,
                entry_date TIMESTAMP NOT NULL,
                exit_date TIMESTAMP,
                entry_price DECIMAL(18,8) NOT NULL,
                exit_price DECIMAL(18,8),
                quantity DECIMAL(18,8) NOT NULL,
                pnl_gross DECIMAL(18,2),
                pnl_net DECIMAL(18,2),
                fees DECIMAL(18,2) DEFAULT 0,
                stop_loss DECIMAL(18,8),
                take_profit DECIMAL(18,8),
                status VARCHAR DEFAULT 'OPEN',
                notes TEXT,
                tags JSONB DEFAULT '[]',
                custom_metrics JSONB DEFAULT '{}',
                ticket INT,
                magic INT,
                mt5_comment VARCHAR,
                source VARCHAR DEFAULT 'manual',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('Ensured trades exists.');

        // 6. Create trade_screenshots
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS trade_screenshots (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
                url VARCHAR NOT NULL,
                caption VARCHAR,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('Ensured trade_screenshots exists.');

        console.log('--- Schema Reconciliation Complete ---');
    } catch (error) {
        console.error('Fatal Error during reconciliation:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
