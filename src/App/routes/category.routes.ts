import { Router } from 'express';
import categoryController from '../controllers/category.controller';
import { validateObjectId } from '../../middlewares/validation.middleware';
import { protect, admin, allowRoles } from '../../middlewares/auth.middleware';

const router = Router();

router.get('/', categoryController.getAllCategories.bind(categoryController));
router.get('/:id', validateObjectId(), categoryController.getCategoryById.bind(categoryController));

router.post('/', protect, allowRoles(['ADMIN', 'STAFF']), categoryController.createCategory.bind(categoryController));
router.put('/:id', protect, allowRoles(['ADMIN', 'STAFF']), validateObjectId(), categoryController.updateCategory.bind(categoryController));
router.delete('/:id', protect, allowRoles(['ADMIN', 'STAFF']), validateObjectId(), categoryController.deleteCategory.bind(categoryController));

export default router;
