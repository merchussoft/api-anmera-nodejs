import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/env';
import prisma from '../config/database';
import { AuthRequest } from '../types';
import { errorResponse } from '../utils/response';

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        let token: string | undefined;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            console.log('Protect: No token provided');
            res.status(401).json(errorResponse('Not authorized, no token provided', 401));
            return;
        }

        const decoded = jwt.verify(token, config.jwtSecret) as { id: string };
        // console.log('Protect: Token decoded', decoded);

        // 1. Try finding in Users (Admins/Staff/Customers)
        let user: any = await prisma.users.findUnique({
            where: { id: decoded.id },
        });

        if (user) {
            req.userType = user.role as any;
            console.log(`[Auth] User detected: ${user.email}, Role: ${user.role}`);
        }

        if (!user) {
            console.log('Protect: User not found for id', decoded.id);
            res.status(401).json(errorResponse('User not found', 401));
            return;
        }

        if (!user.isActive) {
            console.log('Protect: User inactive', user.email);
            res.status(401).json(errorResponse('Account is inactive', 401));
            return;
        }

        req.user = user;
        next();
    } catch (error: any) {
        console.error('Protect Error:', error.name, error.message);
        if (error.name === 'JsonWebTokenError') {
            res.status(401).json(errorResponse('Invalid token', 401));
            return;
        }
        if (error.name === 'TokenExpiredError') {
            res.status(401).json(errorResponse('Token expired', 401));
            return;
        }
        next(error);
    }
};

export const admin = (req: AuthRequest, res: Response, next: NextFunction): void => {
    console.log(`[AdminCheck] req.userType: ${req.userType}`);
    const role = (req.userType as string)?.toUpperCase();
    if (role === 'ADMIN') {
        next();
    } else {
        console.log(`[AdminCheck] Forbidden: role is ${req.userType}`);
        res.status(403).json(errorResponse('Not authorized as admin', 403));
    }
};

export const allowRoles = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        const userRole = (req.userType as string)?.toUpperCase();
        const allowedRoles = roles.map(r => r.toUpperCase());
        console.log(`[RoleCheck] req.userType: ${userRole}, Allowed: ${allowedRoles}`);
        if (userRole && allowedRoles.includes(userRole)) {
            next();
        } else {
            console.log(`[RoleCheck] Forbidden: role ${req.userType} not in ${roles}`);
            res.status(403).json(errorResponse(`Not authorized. Required roles: ${roles.join(', ')}`, 403));
        }
    };
};
