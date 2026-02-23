import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Testing Login Flow ---');
    try {
        const email = 'test@example.com';
        const password = 'password123';

        console.log('1. Finding user...');
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            console.log('User not found!');
            return;
        }
        console.log('User found:', user.id);

        console.log('2. Comparing passwords...');
        const passwordMatches = await bcrypt.compare(password, user.passwordHash || '');
        console.log('Password match:', passwordMatches);

        if (!passwordMatches) return;

        console.log('3. Creating session...');
        const session = await prisma.userSession.create({
            data: {
                userId: user.id,
                refreshTokenHash: 'fake_hash_for_test',
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });
        console.log('Session successful:', session.id);

    } catch (e) {
        console.error('Login Flow Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
