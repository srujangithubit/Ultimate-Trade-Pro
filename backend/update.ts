import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        where: { displayName: null }
    });

    console.log(`Found ${users.length} users needing display names.`);

    for (const u of users) {
        const fallbackName = u.email.split('@')[0];
        // Capitalize the first letter
        const displayName = fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1);

        await prisma.user.update({
            where: { id: u.id },
            data: { displayName }
        });
        console.log(`Updated ${u.email} -> ${displayName}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
