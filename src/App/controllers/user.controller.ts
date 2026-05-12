import { Request, Response, NextFunction } from 'express';
import userService from '../../services/user.service';
import { successResponse, paginatedResponse } from '../../utils/response';
import { Role } from '@prisma/client';
import { PaginationParams } from '../../types';

class UserController {
    async getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { role, search, isActive, page, limit } = req.query;

            const filters = {
                role: role as Role,
                search: search as string,
                isActive: isActive !== undefined ? isActive === 'true' : undefined
            };

            const pagination: PaginationParams = {
                page: page ? parseInt(page as string) : 1,
                limit: limit ? parseInt(limit as string) : 10
            };

            const { data, total } = await userService.getAllUsers(filters, pagination);

            res.json(paginatedResponse(
                data,
                pagination.page!,
                pagination.limit!,
                total
            ));
        } catch (error) {
            next(error);
        }
    }

    async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const user = await userService.getUserById(id);
            res.json(successResponse(user, 'User retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getDeliveryPersonnel(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const users = await userService.getDeliveryPersonnel();
            res.json(successResponse(users, 'Delivery personnel retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const user = await userService.createUser(req.body);
            res.status(201).json(successResponse(user, 'User created successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const user = await userService.updateUser(id, req.body);
            res.json(successResponse(user, 'User updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const user = await userService.deleteUser(id);
            res.json(successResponse(user, 'User deleted successfully'));
        } catch (error) {
            next(error);
        }
    }
}

export default new UserController();
