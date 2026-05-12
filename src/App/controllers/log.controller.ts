import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { successResponse, paginatedResponse } from '../../utils/response';

class LogController {
    async getAllLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { level, action, page, limit } = req.query;

            const pPage = page ? parseInt(page as string) : 1;
            const pLimit = limit ? parseInt(limit as string) : 50;
            const skip = (pPage - 1) * pLimit;

            const where: any = {};
            if (level) where.level = level;
            if (action) where.action = action;

            const [logs, total] = await Promise.all([
                prisma.systemLog.findMany({
                    where,
                    orderBy: {
                        created_at: 'desc'
                    },
                    skip,
                    take: pLimit
                }),
                prisma.systemLog.count({ where })
            ]);

            const formattedLogs = logs.map((log: any) => ({
                ...log,
                createdAt: log.created_at
            }));

            res.json(paginatedResponse(formattedLogs, pPage, pLimit, total));
        } catch (error) {
            next(error);
        }
    }

    async getLogById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const log = await prisma.systemLog.findUnique({
                where: { id }
            });

            if (!log) {
                throw new Error('Log not found');
            }

            res.json(successResponse({
                ...log,
                createdAt: log.created_at
            }, 'Log retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getRecentLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

            const logs = await prisma.systemLog.findMany({
                orderBy: {
                    created_at: 'desc'
                },
                take: limit
            });

            const formattedLogs = logs.map((log: any) => ({
                ...log,
                createdAt: log.created_at
            }));

            res.json(successResponse(formattedLogs, 'Recent logs retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }
}

export default new LogController();
