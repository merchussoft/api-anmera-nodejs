import prisma from '../config/database';
import { CreateOrderDTO, PaginationParams } from '../types';
import productService from './product.service';
import { PrismaClient } from '@prisma/client';

class OrderService {
    async createOrder(customerId: string, orderData: CreateOrderDTO) {
        try {
            const { items, shippingAddress, shippingCost = 0 } = orderData;

            if (!items || items.length === 0) {
                const error: any = new Error('Order must have at least one item');
                error.statusCode = 400;
                throw error;
            }

            // Preparar items con snapshot de producto
            const orderItems = [];
            let subtotal = 0;

            for (const item of items) {
                const product = await prisma.product.findUnique({
                    where: { id: item.productId }
                });

                if (!product) {
                    const error: any = new Error(`Product ${item.productId} not found`);
                    error.statusCode = 404;
                    throw error;
                }

                if (!product.isActive) {
                    const error: any = new Error(`Product ${product.name} is not available`);
                    error.statusCode = 400;
                    throw error;
                }

                await productService.checkStock(item.productId, item.quantity);

                let productImage = null;
                if (product.images) {
                    try {
                        const parsed = JSON.parse(product.images);
                        productImage = Array.isArray(parsed) ? parsed[0] : parsed;
                    } catch {
                        productImage = product.images;
                    }
                }

                orderItems.push({
                    productId: product.id,
                    productName: product.name,
                    productReference: product.reference,
                    productImage,
                    price: product.price,
                    quantity: item.quantity,
                    color: item.color || null,
                    size: item.size || null
                });

                subtotal += (product.price || 0) * item.quantity;
            }

            // Impuesto (IVA) incluido (0 adicional)
            const tax = 0;

            // Crear orden
            const order = await prisma.order.create({
                data: {
                    customerId,
                    subtotal,
                    shippingCost,
                    total: subtotal + shippingCost, // Total es subtotal + shipping
                    paymentMethod: (orderData.paymentMethod as any) || 'WOMPI',
                    shippingName: shippingAddress.name,
                    shippingPhone: shippingAddress.phone,
                    shippingStreet: shippingAddress.street,
                    shippingNeighborhood: shippingAddress.neighborhood,
                    shippingCity: shippingAddress.city,
                    shippingDepartment: shippingAddress.department,
                    items: {
                        create: orderItems
                    }
                },
                include: {
                    customer: {
                        select: { id: true, name: true, email: true, phone: true }
                    },
                    items: true
                }
            });

            return order;
        } catch (error) {
            throw error;
        }
    }

    private async generateInvoiceNumber(): Promise<string> {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const prefix = `FAC-${year}${month}-`;

        // Obtener la última orden del mes para el contador
        const lastOrder = await prisma.order.findFirst({
            where: {
                invoiceNumber: {
                    startsWith: prefix
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        let sequence = 1;
        if (lastOrder && lastOrder.invoiceNumber) {
            const parts = lastOrder.invoiceNumber.split('-');
            const lastSequence = parseInt(parts[2]);
            if (!isNaN(lastSequence)) {
                sequence = lastSequence + 1;
            }
        }

        const sequenceStr = String(sequence).padStart(4, '0');
        return `${prefix}${sequenceStr}`;
    }

    async getUserOrders(customerId: string, pagination: PaginationParams = {}) {
        try {
            const page = pagination.page || 1;
            const limit = pagination.limit || 10;
            const skip = (page - 1) * limit;

            const orders: any[] = await prisma.$queryRawUnsafe(`
                SELECT * FROM orders 
                WHERE customerId = ? 
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            `, customerId, limit, skip);

            const total: any[] = await prisma.$queryRawUnsafe(`
                SELECT COUNT(*) as count FROM orders WHERE customerId = ?
            `, customerId);

            const formattedOrders = orders.map((order: any) => this.mapOrder(order));

            return {
                orders: formattedOrders,
                total: Number(total[0].count),
                page,
                totalPages: Math.ceil(Number(total[0].count) / limit)
            };
        } catch (error) {
            throw error;
        }
    }

    async getAllOrders(pagination: PaginationParams = {}, filters: any = {}) {
        try {
            const page = pagination.page || 1;
            const limit = pagination.limit || 10;
            const { status, paymentStatus, deliveryPersonId } = filters;
            const skip = (page - 1) * limit;

            const where: any = {};
            if (status) where.status = status;
            if (paymentStatus) where.paymentStatus = paymentStatus;
            if (deliveryPersonId) where.deliveryPersonId = deliveryPersonId;

            const [orders, totalCount] = await Promise.all([
                prisma.order.findMany({
                    where,
                    include: {
                        deliveryPerson: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        },
                        items: true
                    },
                    orderBy: {
                        created_at: 'desc'
                    },
                    skip,
                    take: limit
                }),
                prisma.order.count({ where })
            ]);

            const formattedOrders = orders.map((order: any) => this.mapOrder(order));

            return {
                orders: formattedOrders,
                total: totalCount,
                page,
                totalPages: Math.ceil(totalCount / limit)
            };
        } catch (error) {
            throw error;
        }
    }

    async assignDeliveryPerson(orderId: string, deliveryPersonId: string) {
        try {
            const order = await prisma.order.update({
                where: { id: orderId },
                data: {
                    deliveryPersonId,
                    status: 'SHIPPED' // Automatically set to SHIPPED when assigned? Or keep current?
                    // Frontend usually expects it to move to SHIPPED or similar
                }
            });
            return order;
        } catch (error) {
            throw error;
        }
    }

    async getMyDeliveries(deliveryPersonId: string) {
        try {
            const orders = await prisma.order.findMany({
                where: {
                    deliveryPersonId,
                    status: {
                        in: ['SHIPPED', 'DELIVERED']
                    }
                },
                select: {
                    id: true,
                    total: true,
                    status: true,
                    created_at: true,
                    customerId: true
                },
                orderBy: { created_at: 'desc' }
            });

            return orders.map((order: any) => ({
                ...order,
                createdAt: order.created_at
            }));
        } catch (error) {
            throw error;
        }
    }

    async getOrderById(orderId: string, customerId?: string) {
        try {
            const orderResult: any[] = await prisma.$queryRawUnsafe(`
                SELECT * FROM orders WHERE id = ? ${customerId ? 'AND customerId = ?' : ''}
            `, orderId, ...(customerId ? [customerId] : []));

            if (!orderResult || orderResult.length === 0) {
                const error: any = new Error('Order not found');
                error.statusCode = 404;
                throw error;
            }

            const rawOrder = orderResult[0];

            // Manual joins since we are using raw query
            const [items, deliveryPerson] = await Promise.all([
                prisma.orderItem.findMany({ where: { orderId } }),
                rawOrder.delivery_person_id || rawOrder.deliveryPersonId 
                    ? prisma.users.findUnique({ where: { id: rawOrder.delivery_person_id || rawOrder.deliveryPersonId }, select: { id: true, name: true, email: true } })
                    : Promise.resolve(null)
            ]);

            // Fetch history from systemLog
            let history = [];
            try {
                const logs = await prisma.systemLog.findMany({
                    where: {
                        OR: [
                            { message: { contains: orderId } },
                            { metadata: { contains: orderId } }
                        ],
                        action: 'ORDER_STATUS_UPDATE'
                    },
                    orderBy: {
                        created_at: 'desc'
                    }
                });
                
                history = logs.map(log => {
                    let meta = {};
                    try {
                        meta = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;
                    } catch (e) {}
                    
                    return {
                        id: log.id,
                        action: log.action,
                        message: log.message,
                        timestamp: log.created_at,
                        metadata: meta
                    };
                });
            } catch (historyError) {
                console.warn(`Could not fetch history for order ${orderId}:`, historyError);
            }

            return {
                id: rawOrder.id,
                invoiceNumber: rawOrder.invoice_number || rawOrder.invoiceNumber,
                subtotal: Number(rawOrder.subtotal),
                shippingCost: Number(rawOrder.shipping_cost || rawOrder.shippingCost),
                total: Number(rawOrder.total),
                status: rawOrder.status,
                paymentMethod: rawOrder.payment_method || rawOrder.paymentMethod,
                paymentStatus: rawOrder.payment_status || rawOrder.paymentStatus,
                paymentReference: rawOrder.payment_reference || rawOrder.paymentReference,
                shippingName: rawOrder.shipping_name || rawOrder.shippingName,
                shippingPhone: rawOrder.shipping_phone || rawOrder.shippingPhone,
                shippingStreet: rawOrder.shipping_street || rawOrder.shippingStreet,
                shippingNeighborhood: rawOrder.shipping_neighborhood || rawOrder.shippingNeighborhood,
                shippingCity: rawOrder.shipping_city || rawOrder.shippingCity,
                shippingDepartment: rawOrder.shipping_department || rawOrder.shippingDepartment,
                createdAt: rawOrder.created_at,
                items,
                deliveryPerson,
                history
            };
        } catch (error) {
            throw error;
        }
    }

    async getOrderByInvoiceNumber(invoiceNumber: string) {
        try {
            if (!invoiceNumber) return null;
            const cleanInvoice = invoiceNumber.trim().toUpperCase();
            const search = cleanInvoice.startsWith('#') ? cleanInvoice : `#${cleanInvoice}`;

            const order = await prisma.order.findFirst({
                where: {
                    invoiceNumber: {
                        equals: search
                    }
                },
                select: {
                    id: true,
                    total: true,
                    status: true,
                    paymentStatus: true,
                    created_at: true
                }
            });

            if (!order) return null;

            return {
                ...order,
                createdAt: order.created_at
            };
        } catch (error) {
            throw error;
        }
    }

    async updateOrderStatus(orderId: string, status: string) {
        try {
            const existingOrder = await prisma.order.findUnique({
                where: { id: orderId },
                include: { items: true }
            });

            if (!existingOrder) {
                const error: any = new Error('Order not found');
                error.statusCode = 404;
                throw error;
            }

            const updateData: any = { status };

            // Logic for manual "PAID" marking
            if (status === 'PAID' && existingOrder.paymentStatus !== 'APPROVED') {
                updateData.paymentStatus = 'APPROVED';
                
                // Stock reduction if not already reduced
                for (const item of existingOrder.items) {
                    if (item.productId && item.quantity) {
                        try {
                            await productService.reduceStock(item.productId, item.quantity);
                        } catch (e) {
                            console.warn(`[OrderService] Could not reduce stock for product ${item.productId}:`, e);
                        }
                    }
                }

                // Invoice number generation
                if (!existingOrder.invoiceNumber) {
                    updateData.invoiceNumber = await this.generateInvoiceNumber();
                }
            }

            // Sync payment status if order is DELIVERED
            if (status === 'DELIVERED' && existingOrder.paymentStatus !== 'APPROVED') {
                updateData.paymentStatus = 'APPROVED';
                if (!existingOrder.invoiceNumber) {
                    updateData.invoiceNumber = await this.generateInvoiceNumber();
                }
            }

            const order = await prisma.order.update({
                where: { id: orderId },
                data: updateData
            });

            return order;
        } catch (error) {
            throw error;
        }
    }

    async updatePaymentStatus(orderId: string, paymentStatus: string, paymentReference?: string, paymentDetail?: string, paymentMethodType?: string, rawResponse?: any) {
        try {
            // Verificamos si la orden existe para evitar el error de Prisma P2025
            const existingOrder = await prisma.order.findUnique({
                where: { id: orderId }
            });

            if (!existingOrder) {
                console.error(`Order with ID ${orderId} not found for status update`);
                return null;
            }

            const updateData: any = { paymentStatus };

            if (paymentReference) {
                updateData.paymentReference = paymentReference;
            }

            // Note: paymentDetail and paymentMethodType are not in the orders table
            // We will only use them for the PaymentLog below

            if (paymentStatus === 'APPROVED') {
                // When paid, set to PAID so it moves out of initial PENDING state
                updateData.status = 'PAID';

                // Generar número de factura si no existe
                if (!existingOrder.invoiceNumber) {
                    updateData.invoiceNumber = await this.generateInvoiceNumber();
                }
            } else if (paymentStatus === 'REJECTED') {
                updateData.status = 'CANCELLED';
            }

            const order = await prisma.order.update({
                where: { id: orderId },
                data: updateData,
                include: {
                    items: true
                }
            });

            // Crear log de pago
            await prisma.paymentLog.create({
                data: {
                    orderId: order.id,
                    invoiceNumber: order.invoiceNumber,
                    transactionId: paymentReference,
                    status: paymentStatus,
                    paymentMethod: paymentDetail || paymentMethodType || 'UNKNOWN',
                    amount: order.total,
                    rawResponse: rawResponse || null
                }
            });

            if (paymentStatus === 'APPROVED') {
                for (const item of order.items) {
                    if (item.productId && item.quantity) {
                        await productService.reduceStock(item.productId, item.quantity);
                    }
                }
            }

            return order;
        } catch (error) {
            throw error;
        }
    }

    async cancelOrder(orderId: string, customerId?: string) {
        try {
            const where: any = { id: orderId };
            if (customerId) where.customerId = customerId;

            const order = await prisma.order.findFirst({ where });

            if (!order) {
                const error: any = new Error('Order not found');
                error.statusCode = 404;
                throw error;
            }

            if (order.status !== 'PENDING') {
                const error: any = new Error('Only pending orders can be cancelled');
                error.statusCode = 400;
                throw error;
            }

            const updatedOrder = await prisma.order.update({
                where: { id: orderId },
                data: { status: 'CANCELLED' }
            });

            // Fetch history from systemLog
            let history = [];
            try {
                const logs = await prisma.systemLog.findMany({
                    where: {
                        OR: [
                            { message: { contains: orderId } },
                            { metadata: { contains: orderId } }
                        ],
                        action: 'ORDER_STATUS_UPDATE'
                    },
                    orderBy: {
                        created_at: 'desc'
                    }
                });
                
                history = logs.map(log => {
                    let meta = {};
                    try {
                        meta = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;
                    } catch (e) {}
                    
                    return {
                        id: log.id,
                        action: log.action,
                        message: log.message,
                        timestamp: log.created_at,
                        metadata: meta
                    };
                });
            } catch (historyError) {
                console.warn(`Could not fetch history for order ${orderId}:`, historyError);
            }

            return {
                ...this.mapOrder(updatedOrder),
                history
            };
        } catch (error) {
            throw error;
        }
    }

    async addDeliveryEvidence(orderId: string, data: { imageUrl: string; type: string; latitude?: number; longitude?: number }) {
        try {
            const order = await prisma.order.findUnique({ where: { id: orderId } });
            if (!order) {
                const error: any = new Error('Order not found');
                error.statusCode = 404;
                throw error;
            }

            const evidence = await prisma.delivery_evidences.create({
                data: {
                    orderId,
                    imageUrl: data.imageUrl,
                    type: data.type,
                    latitude: data.latitude,
                    longitude: data.longitude
                }
            });

            return evidence;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Limpia órdenes que han estado pendientes por mucho tiempo
     * Útil para liberar stock de carritos abandonados o pagos fallidos cerrados
     */
    async cleanupOldPendingOrders(minutes: number = 15) {
        try {
            const cutoff = new Date();
            cutoff.setMinutes(cutoff.getMinutes() - minutes);

            const oldOrders = await prisma.order.findMany({
                where: {
                    status: 'PENDING',
                    created_at: {
                        lt: cutoff
                    }
                }
            });

            if (oldOrders.length === 0) return 0;

            const result = await prisma.order.updateMany({
                where: {
                    id: {
                        in: oldOrders.map(o => o.id)
                    }
                },
                data: {
                    status: 'CANCELLED'
                }
            });

            console.log(`[OrderService] Auto-cancelled ${result.count} old pending orders.`);
            return result.count;
        } catch (error) {
            console.error('[OrderService] Error in cleanupOldPendingOrders:', error);
            return 0;
        }
    }

    private mapOrder(order: any) {
        if (!order) return null;
        return {
            id: order.id,
            invoiceNumber: order.invoice_number || order.invoiceNumber,
            customerId: order.customerId,
            total: Number(order.total),
            subtotal: Number(order.subtotal || 0),
            shippingCost: Number(order.shipping_cost || order.shippingCost || 0),
            status: order.status,
            paymentMethod: order.payment_method || order.paymentMethod,
            paymentStatus: order.payment_status || order.paymentStatus,
            paymentReference: order.payment_reference || order.paymentReference,
            shippingName: order.shipping_name || order.shippingName,
            shippingPhone: order.shipping_phone || order.shippingPhone,
            shippingStreet: order.shipping_street || order.shippingStreet,
            shippingNeighborhood: order.shipping_neighborhood || order.shippingNeighborhood,
            shippingCity: order.shipping_city || order.shippingCity,
            shippingDepartment: order.shipping_department || order.shippingDepartment,
            createdAt: order.created_at || order.createdAt,
            updatedAt: order.updated_at || order.updatedAt,
            items: order.items || [],
            deliveryPerson: order.deliveryPerson || null
        };
    }
}

export default new OrderService();
