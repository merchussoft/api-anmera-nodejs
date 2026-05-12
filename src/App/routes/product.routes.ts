import { Router } from 'express';
import productController from '../controllers/product.controller';
import { validateObjectId } from '../../middlewares/validation.middleware';
import { protect, allowRoles } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/upload.middleware';

const router = Router();

router.get('/', productController.getAllProducts);
router.get('/:id', validateObjectId(), productController.getProductById);
router.post('/', protect, allowRoles(['ADMIN', 'STAFF']), productController.createProduct);
router.put('/:id', protect, allowRoles(['ADMIN', 'STAFF']), validateObjectId(), productController.updateProduct);
router.patch('/:id/stock', protect, allowRoles(['ADMIN', 'STAFF']), validateObjectId(), productController.updateStock);
router.delete('/:id', protect, allowRoles(['ADMIN', 'STAFF']), validateObjectId(), productController.deleteProduct);
router.patch('/:id/restore', protect, allowRoles(['ADMIN', 'STAFF']), validateObjectId(), productController.restoreProduct);
router.post('/upload-image', protect, allowRoles(['ADMIN', 'STAFF']), upload.single('image') as any, productController.uploadImage);
router.delete('/delete-image', protect, allowRoles(['ADMIN', 'STAFF']), productController.deleteImage);
router.post('/:id/images', protect, allowRoles(['ADMIN', 'STAFF']), validateObjectId(), upload.single('image') as any, productController.uploadImage);
router.delete('/:id/images/:imgId', protect, allowRoles(['ADMIN', 'STAFF']), validateObjectId(), productController.deleteImage);

export default router;