
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkData() {
    const customers = await prisma.customer.findMany();
    const users = await prisma.user.findMany();
    const logs = await prisma.systemLog.findMany({ take: 10, orderBy: { createdAt: 'desc' } });

    console.log('Customers:', customers.length);
    console.log('Users:', users.length);
    console.log('Logs:', JSON.stringify(logs, null, 2));

    await prisma.$disconnect();
}

checkData();
