import { Router } from 'express';
import * as socialController from '../controllers/social.controller';
import { protect, admin } from '../../middlewares/auth.middleware';

const router = Router(); 

// Public routes
router.get('/', socialController.getAllActiveSocialLinks);

// Admin routes
router.post('/', protect, admin, socialController.createSocialLink);
router.get('/all', protect, admin, socialController.getAllSocialLinks);
router.put('/:id', protect, admin, socialController.updateSocialLink);
router.delete('/:id', protect, admin, socialController.deleteSocialLink);


export default router;
