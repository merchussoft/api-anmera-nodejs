import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';

export const validateObjectId = (paramName: string = 'id') => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const id = req.params[paramName];

        // Validar formato UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!id || !uuidRegex.test(id)) {
            res.status(400).json(errorResponse('Invalid ID format', 400));
            return;
        }

        next();
    };
};
