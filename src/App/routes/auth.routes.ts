import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { protect } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/logout', authController.logout.bind(authController));
router.post('/refresh', authController.refreshToken.bind(authController));
router.get('/me', protect, authController.me.bind(authController));
router.get('/profile', protect, authController.getProfile.bind(authController));
router.put('/profile', protect, authController.updateProfile.bind(authController));
router.put('/change-password', protect, authController.changePassword.bind(authController));

export default router;
