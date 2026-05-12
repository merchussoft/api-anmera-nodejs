import { Router } from 'express';
import dashboardController from '../controllers/dashboard.controller';
import { protect } from '../../middlewares/auth.middleware';

const router = Router();

// Requiere autenticación
router.use(protect);

router.get('/stats', dashboardController.getStats.bind(dashboardController));

export default router;
