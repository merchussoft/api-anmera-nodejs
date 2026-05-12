
import { PrismaClient, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
const prisma = new PrismaClient();

async function seedOrders() {
    const customer = await prisma.users.findFirst({ where: { role: 'CUSTOMER' } });
    const delivery = await prisma.users.findFirst({ where: { role: 'DELIVERY' } });
    const product = await prisma.product.findFirst();

    if (!customer || !delivery || !product) {
        console.log('Missing data to create orders');
        const users = await prisma.users.count();
        const prods = await prisma.product.count();
        console.log(`Users: ${users}, Prods: ${prods}`);
        return;
    }

    const existing = await prisma.order.count();
    console.log(`Existing orders: ${existing}`);

    const invoice1 = `FAC-${Date.now()}-1`;
    const invoice2 = `FAC-${Date.now()}-2`;

    console.log('Creating test orders with unique invoices...');

    try {
        // Order 1: READY_FOR_DELIVERY
        await prisma.order.create({
            data: {
                customerId: customer.id,
                invoiceNumber: invoice1,
                subtotal: product.price,
                shippingCost: 5000,
                total: product.price + 5000,
                status: 'READY_FOR_DELIVERY',
                paymentMethod: 'CASH',
                paymentStatus: 'PENDING',
                deliveryPersonId: delivery.id,
                shippingName: customer.name,
                shippingPhone: customer.phone || '1234567890',
                shippingStreet: 'Calle Falsa 123',
                shippingNeighborhood: 'Springfield',
                shippingCity: 'Medellin',
                shippingDepartment: 'Antioquia',
                items: {
                    create: [
                        {
                            productId: product.id,
                            productName: product.name,
                            productImage: product.images[0],
                            price: product.price,
                            quantity: 1
                        }
                    ]
                }
            }
        });

        // Order 2: SHIPPED
        await prisma.order.create({
            data: {
                customerId: customer.id,
                invoiceNumber: invoice2,
                subtotal: product.price * 2,
                shippingCost: 5000,
                total: (product.price * 2) + 5000,
                status: 'SHIPPED',
                paymentMethod: 'WOMPI',
                paymentStatus: 'APPROVED',
                deliveryPersonId: delivery.id,
                shippingName: customer.name,
                shippingPhone: customer.phone || '1234567890',
                shippingStreet: 'Avenida Siempre Viva 742',
                shippingNeighborhood: 'Springfield',
                shippingCity: 'Medellin',
                shippingDepartment: 'Antioquia',
                items: {
                    create: [
                        {
                            productId: product.id,
                            productName: product.name,
                            productImage: product.images[0],
                            price: product.price,
                            quantity: 2
                        }
                    ]
                }
            }
        });

        console.log('✅ 2 orders created and assigned successfully!');
    } catch (e) {
        console.error('Error in seed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

seedOrders();
