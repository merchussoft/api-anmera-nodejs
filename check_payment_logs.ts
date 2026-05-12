import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPaymentLogs() {
    console.log('🔍 Verificando datos de Payment Logs...\n');

    const logs = await prisma.paymentLog.findMany({
        include: {
            order: {
                select: {
                    invoiceNumber: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    console.log(`📝 Total Payment Logs: ${logs.length}\n`);

    if (logs.length === 0) {
        console.log('❌ No hay payment logs en la base de datos');
        console.log('💡 Ejecuta: npx ts-node prisma/seed.ts');
    } else {
        console.log('Logs encontrados:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        logs.forEach((log, index) => {
            console.log(`\n${index + 1}. Invoice: ${log.invoiceNumber || 'N/A'}`);
            console.log(`   Transaction ID: ${log.transactionId}`);
            console.log(`   Status: ${log.status}`);
            console.log(`   Method: ${log.paymentMethod}`);
            console.log(`   Amount: $${log.amount.toLocaleString('es-CO')}`);
            console.log(`   Created: ${log.createdAt.toISOString()}`);
        });
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    // Verificar también payments
    const payments = await prisma.payment.findMany();
    console.log(`\n💳 Total Payments: ${payments.length}`);

    // Verificar órdenes
    const orders = await prisma.order.findMany();
    console.log(`📦 Total Orders: ${orders.length}`);

    await prisma.$disconnect();
}

checkPaymentLogs()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    });
