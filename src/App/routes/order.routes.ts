import { Router } from 'express';
import orderController from '../controllers/order.controller';
import { protect, allowRoles } from '../../middlewares/auth.middleware';
import { validateObjectId } from '../../middlewares/validation.middleware';
import { upload } from '../../middlewares/upload.middleware';
import { normalizeNumber, normalizeString } from '../../utils/normalization';

const router = Router();

router.get('/', protect, orderController.getUserOrders.bind(orderController));
router.get('/my-deliveries', protect, allowRoles(['ADMIN', 'STAFF']), orderController.getMyDeliveries.bind(orderController));
router.get('/:id', protect, validateObjectId(), orderController.getOrderById.bind(orderController));
router.patch('/:id/cancel', protect, validateObjectId(), orderController.cancelOrder.bind(orderController));
router.patch('/:id/status', protect, allowRoles(['ADMIN', 'STAFF']), validateObjectId(), orderController.updateOrderStatus.bind(orderController));
router.patch('/:id/payment-status', protect, allowRoles(['ADMIN', 'STAFF']), validateObjectId(), orderController.updatePaymentStatus.bind(orderController));
router.put('/:id/status', protect, allowRoles(['ADMIN', 'STAFF']), validateObjectId(), orderController.updateOrderStatus.bind(orderController));
router.post('/', protect, orderController.createOrder.bind(orderController));
router.patch('/:id/assign', protect, allowRoles(['ADMIN', 'STAFF']), validateObjectId(), orderController.assignDelivery.bind(orderController));
router.put('/:id/assign', protect, allowRoles(['ADMIN', 'STAFF']), validateObjectId(), orderController.assignDelivery.bind(orderController));
router.post('/:id/evidence', protect, validateObjectId(), upload.single('image') as any, orderController.uploadEvidence.bind(orderController));

export default router;
