import { PrismaClient } from '@prisma/client';
import prisma from '../config/database';
import { normalizeNumber, normalizeString, normalizeDate } from '../utils/normalization';

interface DashboardStats {
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
    ordersByStatus: {
        status: string;
        count: number;
    }[];
    topProducts: {
        id: string;
        name: string;
        totalSold: number;
        revenue: number;
    }[];
    lowStockProducts: {
        id: string;
        name: string;
        stock: number;
    }[];
    recentOrders: {
        id: string;
        invoiceNumber: string;
        customerName: string;
        total: number;
        status: string;
        createdAt: Date;
    }[];
}

class DashboardService {
    async getStats(): Promise<DashboardStats> {
        try {
            // Calcular ventas totales (órdenes PAID y DELIVERED)
            const paidOrders: any[] = await prisma.$queryRawUnsafe(`
                SELECT total FROM orders 
                WHERE status IN ('PAID', 'DELIVERED', 'APPROVED')
            `);

            const totalSales = paidOrders.reduce((sum: number, order: any) => sum + Number(order.total || 0), 0);
            const averageOrderValue = paidOrders.length > 0 
                ? normalizeNumber(totalSales / paidOrders.length) 
                : 0;

            // Órdenes por estado
            const ordersByStatus: any[] = await prisma.$queryRawUnsafe(`
                SELECT status, COUNT(*) as count 
                FROM orders 
                GROUP BY status
            `);

            const ordersByStatusFormatted = ordersByStatus.map((item: any) => ({
                status: normalizeString(item.status || 'PENDING'),
                count: Number(item.count)
            }));

        // Productos más vendidos (top 5) - usando SQL crudo para mayor estabilidad
        const topProducts: any[] = await prisma.$queryRawUnsafe(`
            SELECT productId, SUM(quantity) as quantity 
            FROM order_items 
            GROUP BY productId 
            ORDER BY quantity DESC 
            LIMIT 5
        `);

        const topProductsWithDetails = await Promise.all(
            topProducts.map(async (item: { productId: string | null; quantity: number | null }) => {
                if (!item.productId) return null;
                const products: any[] = await prisma.$queryRawUnsafe(`
                    SELECT id, name, price FROM products WHERE id = ?
                `, item.productId);

                if (products.length === 0) return null;
                const product = products[0];

                const totalSold = Number(item.quantity || 0);
                const price = Number(product.price || 0);

                return {
                    id: normalizeString(product.id),
                    name: normalizeString(product.name) || 'Unknown',
                    totalSold,
                    revenue: totalSold * price
                };
            })
        );
        
        const filteredTopProducts = topProductsWithDetails.filter(p => p !== null) as DashboardStats['topProducts'];

        // Productos con bajo stock (menos de 10)
        const lowStockProductsRaw: any[] = await prisma.$queryRawUnsafe(`
            SELECT id, name, stock FROM products 
            WHERE stock < 10 AND isActive = 1
            ORDER BY stock ASC 
            LIMIT 10
        `);

        const lowStockProducts = lowStockProductsRaw.map(p => ({
            id: normalizeString(p.id),
            name: normalizeString(p.name),
            stock: normalizeNumber(p.stock)
        }));

        // Órdenes recientes (últimas 5)
        const recentOrdersRaw: any[] = await prisma.$queryRawUnsafe(`
            SELECT id, total, status, created_at 
            FROM orders 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        const recentOrders = recentOrdersRaw.map(order => ({
            id: normalizeString(order.id),
            invoiceNumber: normalizeString(order.id.slice(0, 8)),
            customerName: 'Cliente Desconocido',
            total: normalizeNumber(order.total),
            status: normalizeString(order.status),
            createdAt: normalizeDate(order.created_at) || new Date()
        }));

        return {
            totalSales: Number(totalSales),
            totalOrders: paidOrders.length,
            averageOrderValue: Number(averageOrderValue),
            ordersByStatus: ordersByStatusFormatted,
            topProducts: filteredTopProducts,
            lowStockProducts,
            recentOrders
        };
        } catch (error) {
            console.error('Error en dashboard.service.getStats():', error);
            throw error;
        }
    }
}

export default new DashboardService();
