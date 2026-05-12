import { Router } from 'express';
import deliveryController from '../controllers/delivery.controller';
import { protect } from '../../middlewares/auth.middleware';
import { uploadEvidence } from '../../middlewares/upload.middleware';

const router = Router();

// Todas las rutas están protegidas
router.use(protect);

// Middleware para asegurar que solo repartidores accedan (opcional, pero recomendado)
const deliveryOnly = (req: any, res: any, next: any) => {
    if (req.userType === 'DELIVERY' || req.userType === 'ADMIN') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Access denied. Delivery/Admin only.' });
    }
};

router.get('/orders', deliveryOnly, deliveryController.getAssignedOrders);
router.patch('/orders/:id/status', deliveryOnly, deliveryController.updateStatus);
router.post('/orders/:id/evidence', deliveryOnly, uploadEvidence.single('image') as any, deliveryController.uploadEvidence);

export default router;
