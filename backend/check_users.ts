import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Users ---');
    try {
        const users = await prisma.user.findMany();
        console.log(`Found ${users.length} users in database.`);
        for (const user of users) {
            console.log(`- Email: ${user.email} | Hash length: ${user.passwordHash?.length || 'NULL'}`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
