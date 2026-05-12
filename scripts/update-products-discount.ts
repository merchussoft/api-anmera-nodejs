import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateExistingProducts() {
    try {
        console.log('Actualizando productos existentes con campos de descuento...');

        // Actualizar todos los productos que no tienen discount o originalPrice
        const result = await prisma.product.updateMany({
            where: {
                OR: [
                    { discount: null },
                    { originalPrice: null }
                ]
            },
            data: {
                discount: 0,
                originalPrice: null
            }
        });

        console.log(`✅ ${result.count} productos actualizados con éxito`);
        console.log('Migración completada');
    } catch (error) {
        console.error('❌ Error al actualizar productos:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

updateExistingProducts();
