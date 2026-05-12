import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTables() {
    try {
        const result = (await prisma.$queryRaw`SHOW TABLES`) as any[];
        const tables = result.map(row => Object.values(row)[0]);
        console.log('--- TABLES IN DB ---');
        tables.forEach(t => console.log(t));
        console.log('--------------------');
        await prisma.$disconnect();
    } catch (error) {
        console.error('Error querying tables:', error);
        process.exit(1);
    }
}

checkTables();
