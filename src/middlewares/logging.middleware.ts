import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import prisma from '../config/database';

export const actionLogger = async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Definimos qué rutas queremos loguear detalladamente
    const isApiRequest = req.originalUrl.startsWith('/api/');
    const isLogin = req.originalUrl.includes('/auth/login');
    const isDashboard = req.originalUrl.includes('/dashboard');
    
    // Logueamos POST, PUT, DELETE siempre, y GETs importantes como dashboard o logins
    const isDataChange = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    const shouldLog = isDataChange || isDashboard || isLogin;

    if (!isApiRequest || !shouldLog) {
        return next();
    }

    const start = Date.now();
    const originalSend = res.send;

    res.send = function (body) {
        const duration = Date.now() - start;
        
        // Ejecutar de forma asíncrona para no retrasar la respuesta
        setTimeout(async () => {
            try {
                const user = req.user;
                const metadata = {
                    method: req.method,
                    url: req.originalUrl,
                    query: req.query,
                    body: (req.method !== 'GET' && !req.originalUrl.includes('login')) ? req.body : (isLogin ? { email: req.body.email } : undefined),
                    user: user ? {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role
                    } : 'Anonymous',
                    ip: req.ip || req.headers['x-forwarded-for'],
                    duration: `${duration}ms`,
                    statusCode: res.statusCode
                };

                let actionName = `${req.method} ${req.originalUrl.split('?')[0]}`;
                let message = `API Call: ${actionName} by ${user ? user.email : 'Unknown'}`;

                if (isLogin) message = `Login attempt by ${req.body.email}`;
                if (isDashboard) message = `Dashboard stats accessed by ${user ? user.email : 'Unknown'}`;

                await prisma.systemLog.create({
                    data: {
                        level: res.statusCode >= 400 ? 'ERROR' : (res.statusCode >= 300 ? 'WARN' : 'INFO'),
                        action: actionName.slice(0, 255),
                        message: message,
                        metadata: JSON.stringify(metadata)
                    }
                }).catch(err => console.error('Error writing to systemLog:', err));
            } catch (err) {
                // Silently fail logging to avoid crashing the app
            }
        }, 0);

        return originalSend.apply(res, [body]);
    };

    next();
};
