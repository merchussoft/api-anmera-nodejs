
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkOrders() {
    const orders = await prisma.order.findMany({
        include: {
            user: true,
            deliveryPerson: true
        }
    });
    console.log(JSON.stringify(orders, null, 2));
    await prisma.$disconnect();
}

checkOrders();
