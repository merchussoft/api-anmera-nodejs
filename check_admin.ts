import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdmin() {
    try {
        const users = await prisma.users.findMany();
        console.log('Users in DB (first 5):', JSON.stringify(users.slice(0, 5), null, 2));
        await prisma.$disconnect();
    } catch (error) {
        console.error('Error querying users:', error);
        process.exit(1);
    }
}

checkAdmin();
