import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seed iniciado...');

    //////////////////////////////
    // 🧹 CLEAN
    //////////////////////////////
    await prisma.delivery_evidences.deleteMany({});
    await prisma.paymentLog.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.product_colors.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.customers.deleteMany({});
    await prisma.users.deleteMany({});

    //////////////////////////////
    // 👤 USERS
    //////////////////////////////
    const adminPass = await bcrypt.hash('admin123', 10);
    const deliveryPass = await bcrypt.hash('delivery123', 10);

    await prisma.users.create({
        data: {
            name: 'Admin',
            email: 'admin@anmerastore.com',
            password: adminPass,
            role: 'ADMIN'
        }
    });

    await prisma.users.create({
        data: {
            name: 'Delivery',
            email: 'delivery@anmerastore.com',
            password: deliveryPass,
            role: 'DELIVERY'
        }
    });

    //////////////////////////////
    // 📂 CATEGORIES
    //////////////////////////////
    const categorias = await Promise.all([
        prisma.category.create({ data: { name: 'Camisetas', slug: 'camisetas' } }),
        prisma.category.create({ data: { name: 'Vestidos', slug: 'vestidos' } }),
        prisma.category.create({ data: { name: 'Jeans', slug: 'jeans' } })
    ]);

    const getCat = (slug: string) =>
        categorias.find(c => c.slug === slug)!;

    //////////////////////////////
    // 🛍️ PRODUCTS
    //////////////////////////////
    const productos = [
        {
            name: 'Vestido Rosa',
            reference: 'REF-1001',
            price: 120000,
            category: 'vestidos',
            images: ['https://placehold.co/600x600/pink/white'],
            sizes: ['2', '4', '6'],
            colors: [
                { name: 'Rosa', hex: '#FFD1DC', stock: 5 },
                { name: 'Blanco', hex: '#FFFFFF', stock: 5 }
            ]
        },
        {
            name: 'Camiseta Surf',
            reference: 'REF-2002',
            price: 50000,
            category: 'camisetas',
            images: ['https://placehold.co/600x600/blue/white'],
            sizes: ['S', 'M', 'L'],
            colors: [
                { name: 'Azul', hex: '#87CEEB', stock: 8 },
                { name: 'Blanco', hex: '#FFFFFF', stock: 7 }
            ]
        }
    ];

    for (const p of productos) {
        const totalStock = p.colors.reduce((acc, c) => acc + c.stock, 0);

        await prisma.product.create({
            data: {
                name: p.name,
                reference: p.reference,
                price: p.price,
                stock: totalStock,

                // 👇 IMPORTANTE: stringify
                images: JSON.stringify(p.images),
                sizes: JSON.stringify(p.sizes),

                categoryId: getCat(p.category).id,
                isActive: true,
                featured: true,

                product_colors: {
                    create: p.colors.map(c => ({
                        id: crypto.randomUUID(),
                        name: c.name,
                        hex: c.hex,
                        stock: c.stock
                    }))
                }
            }
        });
    }

    console.log('🎉 Seed completado');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());