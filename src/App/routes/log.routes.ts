import { Router } from 'express';
import logController from '../controllers/log.controller';
import { validateObjectId } from '../../middlewares/validation.middleware';
import { protect, admin } from '../../middlewares/auth.middleware';

const router = Router();

// Todas las rutas de logs requieren autenticación y rol ADMIN
router.use(protect);
router.use(admin);

router.get('/', logController.getAllLogs.bind(logController));
router.get('/recent', logController.getRecentLogs.bind(logController));
router.get('/:id', validateObjectId(), logController.getLogById.bind(logController));

export default router;
