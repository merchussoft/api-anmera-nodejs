import { Router } from 'express';
import paymentController from '../controllers/payment.controller';
import { protect, allowRoles } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/create-session', protect, paymentController.createPaymentSession.bind(paymentController));
router.post('/widget-config', protect, paymentController.getWidgetConfig.bind(paymentController));
router.post('/webhook/wompi', paymentController.wompiWebhook.bind(paymentController));
router.get('/check-status/:id', paymentController.checkStatus.bind(paymentController));
router.get('/verify-sync/:orderId', protect, paymentController.verifyAndSyncPayment.bind(paymentController));
router.get('/', protect, allowRoles(['ADMIN', 'STAFF']), paymentController.getAllPayments.bind(paymentController));
router.get('/logs', protect, allowRoles(['ADMIN', 'STAFF']), paymentController.getPaymentLogs.bind(paymentController));
router.get('/:id', protect, allowRoles(['ADMIN', 'STAFF']), paymentController.getPaymentById.bind(paymentController));

export default router;
