import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { errorResponse } from '../utils/response';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error:', err);
    }

    // Error de validación de Prisma
    if (err instanceof PrismaClientValidationError) {
        res.status(400).json(errorResponse('Validation Error', 400, err.message));
        return;
    }

    // Error de registro único duplicado
    if (err instanceof PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            const target = err.meta?.target;
            const field = Array.isArray(target) ? target.join(', ') : (typeof target === 'string' ? target : 'field');
            res.status(400).json(errorResponse(`${field} already exists`, 400));
            return;
        }
        if (err.code === 'P2025') {
            res.status(404).json(errorResponse('Record not found', 404));
            return;
        }
        if (err.code === 'P2003') {
            const field = err.meta?.field_name || 'relation field';
            res.status(400).json(errorResponse(`Foreign key constraint failed on ${field}. Ensure the referenced record exists.`, 400));
            return;
        }
    }

    // Error de CORS
    if (err.message === 'Not allowed by CORS') {
        res.status(403).json(errorResponse('CORS Error: Origin not allowed', 403));
        return;
    }

    // Error de sintaxis JSON
    if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
        res.status(400).json(errorResponse('Invalid JSON', 400));
        return;
    }

    // Error personalizado con statusCode
    if (err.statusCode) {
        res.status(err.statusCode).json(errorResponse(err.message, err.statusCode, err.errors));
        return;
    }

    // Error genérico del servidor
    res.status(500).json(
        errorResponse(
            process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
            500
        )
    );
};

export const notFoundHandler = (req: Request, res: Response): void => {
    res.status(404).json(errorResponse(`Route ${req.originalUrl} not found`, 404));
};
