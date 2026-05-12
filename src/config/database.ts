import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'production' 
        ? ['error', 'warn']
        : [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
        ] as any,
});

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
    // @ts-ignore - query event is only available when emit: 'event' is used
    prisma.$on('query', (e: any) => {
        console.log(`\x1b[36m[Prisma Query]\x1b[0m ${e.query} \x1b[33m(${e.duration}ms)\x1b[0m`);
    });
}

let isConnected = false;

const connectWithRetry = async (retries = 5, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
        try {
            await prisma.$connect();
            isConnected = true;
            console.log('✅ Database connected successfully');
            return;
        } catch (error: any) {
            console.error(`❌ Database connection attempt ${i + 1} failed:`, error.message);
            if (i < retries - 1) {
                console.log(`⏳ Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('❌ All database connection attempts failed');
                throw error;
            }
        }
    }
};

connectWithRetry().catch((error) => {
    console.error('❌ Database connection error:', error);
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
});

process.on('beforeExit', async () => {
    if (isConnected) {
        await prisma.$disconnect();
    }
});

export default prisma;
