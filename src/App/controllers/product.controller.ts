import { Request, Response, NextFunction } from 'express';
import productService from '../../services/product.service';
import storageService from '../../services/s3.storage.service';
import { successResponse, paginatedResponse } from '../../utils/response';
import { ProductFilters, PaginationParams } from '../../types';
import config from '../../config/env';

class ProductController {
    getAllProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { category, categoryId, search, minPrice, maxPrice, featured, page, limit, isActive, gender, sort } = req.query;

            const filters: ProductFilters = {};
            const categoryFilter = (category || categoryId) as string;

            if (categoryFilter) filters.category = categoryFilter;
            if (search) filters.search = search as string;
            if (minPrice) filters.minPrice = parseInt(minPrice as string);
            if (maxPrice) filters.maxPrice = parseInt(maxPrice as string);
            if (featured) filters.featured = featured === 'true';
            if (isActive !== undefined) filters.isActive = isActive === 'true';
            if (gender) filters.gender = gender as any;
            if (sort) filters.sort = sort as string;

            const pagination: PaginationParams = {
                page: page ? parseInt(page as string) : 1,
                limit: limit ? parseInt(limit as string) : 20
            };

            const result = await productService.getAllProducts(filters, pagination);

            res.json(paginatedResponse(result.products, result.page, pagination.limit!, result.total));
        } catch (error) {
            next(error);
        }
    }

    getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;
            const product = await productService.getProductById(id);

            res.json(successResponse(product, 'Product retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const product = await productService.createProduct(req.body);
            res.status(201).json(successResponse(product, 'Product created successfully'));
        } catch (error) {
            next(error);
        }
    }

    updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;
            const product = await productService.updateProduct(id, req.body);
            res.json(successResponse(product, 'Product updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;
            await productService.deleteProduct(id);
            res.json(successResponse(null, 'Product deactivated successfully'));
        } catch (error) {
            next(error);
        }
    }

    restoreProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;
            const product = await productService.restoreProduct(id);
            res.json(successResponse(product, 'Product restored successfully'));
        } catch (error) {
            next(error);
        }
    }

    updateStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;
            const { stock } = req.body;
            const product = await productService.updateStock(id, stock);
            res.json(successResponse(product, 'Stock updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Subir imagen de producto a S3
     */
    uploadImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.file) {
                res.status(400).json({ success: false, message: 'No image file provided' });
                return;
            }

            const imageUrl = await storageService.uploadFile(req.file, config.s3BucketName, 'products');

            res.status(201).json({ success: true, data: imageUrl, message: 'Image uploaded successfully' });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Eliminar imagen de producto de S3
     */
    deleteImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { url } = req.body;

            console.log('url', url);

            if (!url) {
                res.status(400).json({ success: false, message: 'No image URL provided' });
                return;
            }

            await storageService.deleteFile(url, config.s3BucketName);

            res.json({ success: true, message: 'Image deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
}

const productController = new ProductController();
export default productController;

