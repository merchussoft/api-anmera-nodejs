import { Request, Response, NextFunction } from 'express';
import paymentService from '../../services/payment.service';
import orderService from '../../services/order.service';
import { AuthRequest } from '../../types';
import { successResponse } from '../../utils/response';

class PaymentController {
    async createPaymentSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { orderId } = req.body;

            const order = await orderService.getOrderById(orderId, req.user!.id);

            if (order.paymentStatus === 'APPROVED') {
                res.status(400).json({ success: false, message: 'Order already paid' });
                return;
            }

            const session = await paymentService.createPaymentSession(order as any);

            res.status(201).json(successResponse(session, 'Payment session created successfully'));
        } catch (error) {
            next(error);
        }
    }

async wompiWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            console.log('📥 Wompi Webhook received:', JSON.stringify(req.body, null, 2));
            // Wompi sends the event data in the body
            const eventData = req.body;
            await paymentService.processWompiWebhook(eventData);
            res.status(200).json({ success: true });
        } catch (error: any) {
            console.error('Wompi webhook error:', error.message);
            res.status(400).send(`Webhook Error: ${error.message}`);
        }
    }

async checkStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params; // Transaction ID from Wompi
            const result = await paymentService.checkWompiStatus(id);
            res.status(200).json(successResponse(result, 'Payment status checked successfully'));
        } catch (error: any) {
            next(error);
        }
    }

    async verifyAndSyncPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { orderId } = req.params;
            const result = await paymentService.verifyAndSyncPayment(orderId);
            res.status(200).json(successResponse(result, 'Payment verified and synced successfully'));
        } catch (error: any) {
            next(error);
        }
    }

    async getAllPayments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { status, provider } = req.query;
            const payments = await paymentService.getAllPayments({ status, provider });
            res.json(successResponse(payments, 'Payments retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getPaymentById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const payment = await paymentService.getPaymentById(id);
            res.json(successResponse(payment, 'Payment retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

async getPaymentLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { orderId } = req.query;
            const logs = await paymentService.getPaymentLogs(orderId as string);
            res.json(successResponse(logs, 'Payment logs retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getWidgetConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { orderId } = req.body;

            if (!orderId) {
                res.status(400).json({ success: false, message: 'Order ID is required' });
                return;
            }

            const config = await paymentService.createWidgetConfig(orderId);

            res.json(successResponse(config, 'Widget config created successfully'));
        } catch (error) {
            next(error);
        }
    }
}

export default new PaymentController();
