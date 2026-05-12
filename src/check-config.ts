import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
const prisma = new PrismaClient();

async function checkConfig() {
    console.log('ENV Token starts with:', process.env.WHATSAPP_ACCESS_TOKEN?.substring(0, 15));

    const dbConfig = await prisma.whatsapp_config.findFirst({
        where: { isActive: true }
    });

    if (dbConfig) {
        console.log('DB Token starts with:', dbConfig.accessToken?.substring(0, 15));

        if (dbConfig.accessToken !== process.env.WHATSAPP_ACCESS_TOKEN) {
            console.log('⚠️  MISMATCH DETECTED! Database has a different token than .env');
            console.log('Updating database to match .env...');

            await prisma.whatsapp_config.update({
                where: { id: dbConfig.id },
                data: {
                    accessToken: process.env.WHATSAPP_ACCESS_TOKEN as string,
                    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID as string,
                    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID as string,
                    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN as string
                }
            });
            console.log('✅ Database updated successfully.');
        } else {
            console.log('✅ Database matches .env');
        }
    } else {
        console.log('❌ No active config found in database.');
    }
}

checkConfig()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
