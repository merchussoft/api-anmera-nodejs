import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('--- PRISMA MODELS ---');
Object.keys(prisma)
    .filter(k => !k.startsWith('$') && !k.startsWith('_'))
    .sort()
    .forEach(k => console.log(k));
process.exit(0);
