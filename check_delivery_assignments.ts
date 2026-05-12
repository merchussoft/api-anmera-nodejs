import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const deliveryUsers = await prisma.users.findMany({
    where: { role: 'DELIVERY' },
    select: { id: true, name: true, email: true }
  });

  console.log('--- Delivery Users ---');
  deliveryUsers.forEach(u => console.log(`${u.name} (${u.email}): ${u.id}`));

  const assignedOrders = await prisma.order.findMany({
    where: {
      deliveryPersonId: { not: null }
    },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      deliveryPersonId: true
    }
  });

  console.log('\n--- Assigned Orders ---');
  if (assignedOrders.length === 0) {
    console.log('No orders assigned to any delivery person.');
  } else {
    assignedOrders.forEach(o => {
      const user = deliveryUsers.find(u => u.id === o.deliveryPersonId);
      console.log(`Order #${o.invoiceNumber} (ID: ${o.id}) - Status: ${o.status} - Assigned to: ${user ? user.name : o.deliveryPersonId}`);
    });
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
