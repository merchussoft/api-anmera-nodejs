import { Request, Response, NextFunction } from 'express';
import categoryService from '../../services/category.service';
import { successResponse, paginatedResponse } from '../../utils/response';

class CategoryController {
    async getAllCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { isActive } = req.query;
            const { categories, total, page, totalPages } = await categoryService.getAllCategories(
                { isActive: isActive !== undefined ? isActive === 'true' : undefined },
                { page: 1, limit: 100 }
            );
            res.json(paginatedResponse(categories, page, 100, total));
        } catch (error) {
            next(error);
        }
    }

    async getCategoryById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const category = await categoryService.getCategoryById(id);
            res.json(successResponse(category, 'Category retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const category = await categoryService.createCategory(req.body);
            res.status(201).json(successResponse(category, 'Category created successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const category = await categoryService.updateCategory(id, req.body);
            res.json(successResponse(category, 'Category updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const category = await categoryService.deleteCategory(id);
            res.json(successResponse(category, 'Category deleted successfully'));
        } catch (error) {
            next(error);
        }
    }
}

export default new CategoryController();
