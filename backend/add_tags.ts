import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';`);
        console.log('Successfully added tags column to playbooks table.');
    } catch (error) {
        console.error('Error adding tags column:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
