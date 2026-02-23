import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Fixing trades table schema (Part 2) ---');
    try {
        const commands = [
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS backtest_session_id UUID;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS playbook_id UUID;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS symbol VARCHAR;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS direction VARCHAR;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS setup VARCHAR;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS fees DECIMAL(18,2) DEFAULT 0;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS stop_loss DECIMAL(18,8);`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS take_profit DECIMAL(18,8);`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS custom_metrics JSONB DEFAULT '{}';`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS ticket INTEGER;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS magic INTEGER;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS mt5_comment VARCHAR;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'manual';`
        ];

        for (const cmd of commands) {
            try {
                await prisma.$executeRawUnsafe(cmd);
                console.log(`Executed: ${cmd}`);
            } catch (e: any) {
                console.error(`Failed: ${cmd} - ${e.message}`);
            }
        }
        console.log('Done aligning trades table!');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
