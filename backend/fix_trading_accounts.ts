import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking trading_accounts table ---');
    try {
        const result = await prisma.$queryRawUnsafe(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'trading_accounts';
        `);
        console.log("Current columns:");
        console.log(JSON.stringify(result, null, 2));

        // Add missing fields based on @map in schema.prisma
        console.log('\n--- Adding mapped columns ---');

        const commands = [
            `ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS account_type VARCHAR DEFAULT 'live';`,
            `ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS account_login VARCHAR;`,
            `ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS api_key_hash VARCHAR;`,
            `ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;`,
            `ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();`,
            `ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`
        ];

        for (const cmd of commands) {
            try {
                await prisma.$executeRawUnsafe(cmd);
                console.log(`Executed: ${cmd}`);
            } catch (e: any) {
                console.error(`Failed: ${cmd} - ${e.message}`);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
