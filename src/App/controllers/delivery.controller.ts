import { Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../types';
import { successResponse, errorResponse, paginatedResponse } from '../../utils/response';
import { LoggerService } from '../services/logger.service';
import storageService from '../../services/storage.service';

class DeliveryController {
    /**
     * Listar pedidos asignados al repartidor
     */
    async getAssignedOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const deliveryId = req.user!.id;

            const orders = await prisma.order.findMany({
                where: {
                    deliveryPersonId: deliveryId,
                    status: {
                        in: ['PENDING', 'PAID', 'READY_FOR_DELIVERY', 'SHIPPED', 'DELIVERED', 'FAILED_DELIVERY']
                    }
                },
                select: {
                    id: true,
                    invoiceNumber: true,
                    total: true,
                    status: true,
                    paymentStatus: true,
                    shippingName: true,
                    shippingPhone: true,
                    shippingStreet: true,
                    shippingNeighborhood: true,
                    shippingCity: true,
                    shippingDepartment: true,
                    updated_at: true,
                    created_at: true,
                    customer: {
                        select: {
                            name: true,
                            phone: true,
                            email: true
                        }
                    },
                    items: {
                        select: {
                            id: true,
                            productName: true,
                            price: true,
                            quantity: true,
                            color: true,
                            size: true,
                            productImage: true
                        }
                    },
                    delivery_evidences: {
                        select: {
                            id: true,
                            imageUrl: true,
                            type: true,
                            created_at: true
                        }
                    }
                },
                orderBy: {
                    updated_at: 'desc'
                }
            });

            res.json(successResponse(orders, 'Assigned orders retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Actualizar estado de entrega
     */
    async updateStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const { status, failureReason, failureNotes } = req.body;
            const deliveryId = req.user!.id;

            const order = await prisma.order.findFirst({
                where: { id, deliveryPersonId: deliveryId }
            });

            if (!order) {
                res.status(404).json(errorResponse('Order not found or not assigned to you', 404));
                return;
            }

            const updateData: any = { status };

            const updatedOrder = await prisma.order.update({
                where: { id },
                data: updateData
            });

            await LoggerService.info('DELIVERY_STATUS_UPDATE', `Order ${id} status updated to ${status} by delivery ${deliveryId}`);

            res.json(successResponse(updatedOrder, 'Order status updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Subir evidencia de entrega a Supabase S3
     */
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

            try {
                const imageUrl = await storageService.uploadFile(req.file, 'delivery-evidence', 'evidence');

                const evidence = await prisma.delivery_evidences.create({
                    data: {
                        orderId: order.id,
                        imageUrl,
                        type: type || 'CLIENTE',
                        latitude: latitude ? parseFloat(latitude as string) : null,
                        longitude: longitude ? parseFloat(longitude as string) : null
                    }
                });

                await LoggerService.info('DELIVERY_EVIDENCE_UPLOAD', `Evidence uploaded for order ${id}`, {
                    evidenceId: evidence.id,
                    imageUrl,
                    type: type || 'CLIENTE',
                    deliveryId,
                });

                res.status(201).json(successResponse(evidence, 'Delivery evidence uploaded successfully'));
            } catch (uploadError) {
                await LoggerService.error('DELIVERY_EVIDENCE_UPLOAD_ERROR', `Failed to upload evidence to Supabase S3: ${uploadError}`, {
                    orderId: id,
                    deliveryId,
                });
                res.status(500).json(errorResponse('Failed to upload evidence to storage', 500));
            }
        } catch (error) {
            next(error);
        }
    }
}

export default new DeliveryController();