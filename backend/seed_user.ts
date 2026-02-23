import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Seeding Test User ---');
    try {
        const email = 'test@example.com';
        const password = 'password123';
        const hash = await bcrypt.hash(password, 10);

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            console.log('Updating existing test user.');
            await prisma.user.update({
                where: { email },
                data: { passwordHash: hash }
            });
        } else {
            console.log('Creating new test user.');
            await prisma.user.create({
                data: {
                    email,
                    passwordHash: hash,
                    displayName: 'Test User'
                }
            });
        }

        console.log(`Success! You can now log in with:
Email: ${email}
Password: ${password}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
