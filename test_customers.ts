import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCustomers() {
    try {
        const count = await prisma.customers.count();
        console.log(`Successfully reached the 'customers' table. Count: ${count}`);
        await prisma.$disconnect();
    } catch (error) {
        console.error('Error reaching customers table:', error);
        process.exit(1);
    }
}

checkCustomers();
