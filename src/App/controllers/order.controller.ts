import { Response, NextFunction } from 'express';
import prisma from '../../config/database';
import orderService from '../../services/order.service';
import paymentService from '../../services/payment.service';
import storageService from '../../services/storage.service';
import { AuthRequest, CreateOrderDTO, PaginationParams } from '../../types';
import { successResponse, errorResponse, paginatedResponse } from '../../utils/response';
import { LoggerService } from '../services/logger.service';
import { WhatsAppService } from '../services/whatsapp.service';

const whatsappService = new WhatsAppService();

class OrderController {
    async createOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const orderData: CreateOrderDTO = req.body;

            // 1. Crear orden
            const order = await orderService.createOrder(req.user!.id, orderData);

            // 2. Crear sesión de pago automáticamente
            const paymentSession = await paymentService.createPaymentSession(order as any);

            // 3. Enviar notificación de WhatsApp (asíncrono)
            whatsappService.sendOrderConfirmation(order).catch(err => {
                console.error('Failed to send WhatsApp order confirmation:', err);
            });

            // 4. Retornar orden con URL de pago
            res.status(201).json(successResponse({
                ...order,
                paymentUrl: paymentSession.paymentUrl,
                paymentSessionId: paymentSession.sessionId
            }, 'Order created successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getUserOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            // Trigger cleanup of old pending orders (max 15 min)
            // We run this as a background task here to keep order lists fresh
            orderService.cleanupOldPendingOrders(15).catch(e => console.error('Auto-cleanup trigger failed:', e));

            const { page, limit, status, paymentStatus, startDate, endDate, deliveryPersonId } = req.query;

            const pagination: PaginationParams = {
                page: page ? parseInt(page as string) : 1,
                limit: limit ? parseInt(limit as string) : 10
            };

            const filters = { status, paymentStatus, startDate, endDate, deliveryPersonId };

            const userRole = (req.userType as string)?.toUpperCase();
            let result;

            if (userRole === 'ADMIN' || userRole === 'STAFF') {
                result = await orderService.getAllOrders(pagination, filters);
            } else {
                result = await orderService.getUserOrders(req.user!.id, pagination);
            }

            res.json(paginatedResponse(result.orders, result.page, pagination.limit!, result.total));
        } catch (error) {
            next(error);
        }
    }

    async getOrderById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const userRole = (req.userType as string)?.toUpperCase();
            const isAdminOrInternal = userRole === 'ADMIN' || userRole === 'STAFF' || userRole === 'DELIVERY';
            const customerId = isAdminOrInternal ? undefined : req.user!.id;
            const order = await orderService.getOrderById(id, customerId);

            res.json(successResponse(order, 'Order retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async cancelOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            // Admin can cancel any order? Or only customer?
            // If Admin, pass undefined as userId to allow bypassing ownership check
            const userId = req.userType === 'ADMIN' ? undefined : req.user!.id;

            const order = await orderService.cancelOrder(id, userId);

            res.json(successResponse(order, 'Order cancelled successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updateOrderStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const order = await orderService.updateOrderStatus(id, status);

            // Send WhatsApp notification asynchronously (don't wait for it)
            try {
                const orderWithDetails = await prisma.order.findUnique({
                    where: { id },
                    include: {
                        customer: true,
                        items: {
                            include: {
                                product: true
                            }
                        }
                    }
                });

                if (orderWithDetails) {
                    whatsappService.sendOrderStatusUpdate(orderWithDetails, status)
                        .then(() => {
                            LoggerService.info('WHATSAPP_NOTIFICATION', `Status update sent for order ${id}`);
                        })
                        .catch((err) => {
                            // Log error but don't fail the request
                            LoggerService.error('WHATSAPP_NOTIFICATION_FAILED', `Failed to send WhatsApp for order ${id}`, { error: err.message });
                        });
                }
            } catch (whatsappError) {
                // Silently log - don't fail the status update
                console.error('WhatsApp notification error:', whatsappError);
            }

            res.json(successResponse(order, 'Order status updated successfully'));

            // Log status update for history
            try {
                await LoggerService.info('ORDER_STATUS_UPDATE', `Order ${id} changed to ${status}`, {
                    orderId: id,
                    newStatus: status,
                    updatedAt: new Date()
                });
            } catch (logError) {
                console.error('Failed to log order status update:', logError);
            }
        } catch (error) {
            next(error);
        }
    }

    async updatePaymentStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const { paymentStatus, paymentReference } = req.body;

            const order = await orderService.updatePaymentStatus(
                id, 
                paymentStatus, 
                paymentReference, 
                'ADMIN_MANUAL_UPDATE',
                'MANUAL'
            );

            res.json(successResponse(order, 'Payment status updated successfully'));

            // Log payment update for history
            try {
                await LoggerService.info('ORDER_STATUS_UPDATE', `Payment for order ${id} marked as ${paymentStatus}`, {
                    orderId: id,
                    newStatus: paymentStatus,
                    isPayment: true,
                    updatedAt: new Date()
                });
            } catch (logError) {
                console.error('Failed to log payment status update:', logError);
            }
        } catch (error) {
            next(error);
        }
    }

    async assignDelivery(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const { deliveryPersonId } = req.body;

            const order = await orderService.assignDeliveryPerson(id, deliveryPersonId);
            res.json(successResponse(order, 'Delivery person assigned successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getMyDeliveries(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const orders = await orderService.getMyDeliveries(req.user!.id);
            res.json(successResponse(orders, 'My deliveries retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async uploadEvidence(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const { type, latitude, longitude } = req.body;
            const deliveryId = req.user!.id;

            const order = await prisma.order.findFirst({
                where: { id, deliveryPersonId: deliveryId }
            });

            if (!order) {
                res.status(404).json(errorResponse('Order not found or not assigned to you', 404));
                return;
            }

            if (!req.file) {
                res.status(400).json(errorResponse('No image uploaded', 400));
                return;
            }

            const imageUrl = `${process.env.API_URL || 'http://localhost:3000'}/uploads/evidence/${req.file.filename}`;

            const evidence = await prisma.delivery_evidences.create({
                data: {
                    orderId: id,
                    imageUrl,
                    type: type || 'CLIENTE',
                    latitude: latitude ? parseFloat(latitude as string) : null,
                    longitude: longitude ? parseFloat(longitude as string) : null
                }
            });

            res.status(201).json(successResponse(evidence, 'Delivery evidence uploaded successfully'));
        } catch (error) {
            next(error);
        }
    }

}

export default new OrderController();
