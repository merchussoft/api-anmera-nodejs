import { Request, Response, NextFunction } from 'express';
import dashboardService from '../../services/dashboard.service';
import { successResponse } from '../../utils/response';

class DashboardController {
    async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const stats = await dashboardService.getStats();
            res.json(successResponse(stats, 'Dashboard stats retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }
}

export default new DashboardController();
