import { Router } from 'express';
import userController from '../controllers/user.controller';
import { validateObjectId } from '../../middlewares/validation.middleware';
import { protect, admin } from '../../middlewares/auth.middleware';

const router = Router();

// Todas las rutas de usuarios requieren autenticación y rol ADMIN
router.use(protect);
router.use(admin);

router.get('/', userController.getAllUsers.bind(userController));
router.post('/', userController.createUser.bind(userController));
router.get('/delivery', userController.getDeliveryPersonnel.bind(userController));
router.get('/:id', validateObjectId(), userController.getUserById.bind(userController));
router.put('/:id', validateObjectId(), userController.updateUser.bind(userController));
router.delete('/:id', validateObjectId(), userController.deleteUser.bind(userController));

export default router;
