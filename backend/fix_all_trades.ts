import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Fixing trades table schema ---');
    try {
        const requiredColumns = [
            'id', 'account_id', 'session_id', 'user_id',
            'instrument', 'direction', 'entry_date', 'exit_date',
            'entry_price', 'exit_price', 'quantity', 'pnl_gross',
            'commission', 'swap', 'pnl_net', 'status', 'strategy',
            'screenshot_url', 'notes', 'tags', 'created_at', 'updated_at',
            'playbook_id'
        ];

        const commands = [
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS account_id UUID;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS session_id UUID;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS user_id UUID;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_date TIMESTAMP;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS exit_date TIMESTAMP;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_price DECIMAL(10,5);`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS exit_price DECIMAL(10,5);`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS pnl_gross DECIMAL(10,2);`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS pnl_net DECIMAL(10,2);`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS playbook_id UUID;`
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
