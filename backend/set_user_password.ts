import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Setting Password for Actual User ---');
    try {
        const email = 'lingegowdan7@gmail.com';
        const password = 'password123';
        const hash = await bcrypt.hash(password, 10);

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            console.log(`Updating existing user ${email}.`);
            await prisma.user.update({
                where: { email },
                data: { passwordHash: hash, isVerified: true }
            });
            console.log('Password has been set successfully!');
        } else {
            console.log('Error: User not found in database.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
