import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Testing connection...');
    const result = await prisma.$queryRaw`SELECT 1 as result`;
    console.log('Success:', result);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
