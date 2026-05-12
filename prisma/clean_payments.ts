import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanPayments() {
    console.log('🧹 Limpiando datos de pagos de prueba...');

    // Eliminar evidencias de entrega
    const deletedEvidences = await prisma.deliveryEvidence.deleteMany({});
    console.log(`✅ Eliminadas ${deletedEvidences.count} evidencias de entrega`);

    // Eliminar logs de pago
    const deletedLogs = await prisma.paymentLog.deleteMany({});
    console.log(`✅ Eliminados ${deletedLogs.count} logs de pago`);

    // Eliminar items de órdenes
    const deletedItems = await prisma.orderItem.deleteMany({});
    console.log(`✅ Eliminados ${deletedItems.count} items de órdenes`);

    // Eliminar pagos
    const deletedPayments = await prisma.payment.deleteMany({});
    console.log(`✅ Eliminados ${deletedPayments.count} pagos`);

    // Eliminar órdenes
    const deletedOrders = await prisma.order.deleteMany({});
    console.log(`✅ Eliminadas ${deletedOrders.count} órdenes`);

    console.log('');
    console.log('🎉 Limpieza completada!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Ahora puedes hacer pedidos reales sin datos de prueba.');
    console.log('Los productos, categorías y usuarios NO fueron eliminados.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

cleanPayments()
    .catch((e) => {
        console.error('❌ Error limpiando datos:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
