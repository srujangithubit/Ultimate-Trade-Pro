import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking trades table ---');
    try {
        const result = await prisma.$queryRawUnsafe(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'trades';
        `);
        console.log("Current columns in trades:");
        console.log(JSON.stringify(result, null, 2));

        // Add missing fields based on @map in schema.prisma for Trade
        console.log('\n--- Adding mapped columns ---');

        const commands = [
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS user_id UUID;`,
            `-- Try to link it up, but if data exists without users, ignore constraint for now
             -- ALTER TABLE trades ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;`
        ];

        for (const cmd of commands) {
            try {
                if (!cmd.startsWith('--')) {
                    await prisma.$executeRawUnsafe(cmd);
                    console.log(`Executed: ${cmd}`);
                }
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
