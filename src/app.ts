import express, { Application } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import corsMiddleware from './middlewares/cors.middleware';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { createRateLimit, rateLimits } from './middlewares/rateLimit.middleware';
import { actionLogger } from './middlewares/logging.middleware';
import authRoutes from './App/routes/auth.routes';
import productRoutes from './App/routes/product.routes';
import orderRoutes from './App/routes/order.routes';
import paymentRoutes from './App/routes/payment.routes';
import deliveryRoutes from './App/routes/delivery.routes';
import categoryRoutes from './App/routes/category.routes';
import userRoutes from './App/routes/user.routes';
import logRoutes from './App/routes/log.routes';
import dashboardRoutes from './App/routes/dashboard.routes';
import socialRoutes from './App/routes/social.routes';
import whatsappRoutes from './App/routes/whatsapp.routes';

const app: Application = express();

// Middlewares de seguridad
app.use(helmet());
app.use(corsMiddleware);
app.use(cookieParser());

// Middlewares de parseo
app.use(express.json({
    limit: '10mb',
    verify: (req: any, res, buf) => {
        if (req.originalUrl.includes('/webhook')) {
            req.rawBody = buf;
        }
    }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(actionLogger);
app.use('/uploads', express.static('uploads'));

// Middleware de logging en desarrollo
if (process.env.NODE_ENV === 'development') {
    app.use((req, _res, next) => {
        console.log(`${req.method} ${req.path}`);
        next();
    });
}

// Health check
app.get('/health', (_req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'AnmeraStore API',
        version: '1.0.0',
        database: 'PostgreSQL/MySQL with Prisma ORM'
    });
});

// Ruta raíz
app.get('/', (_req, res) => {
    res.json({
        message: 'AnmeraStore API - Backend for Colombian Ecommerce (TypeScript + Prisma)',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            products: '/api/products',
            categories: '/api/categories',
            orders: '/api/orders',
            payments: '/api/payments',
            users: '/api/users',
            logs: '/api/logs',
            dashboard: '/api/dashboard',
            social: '/api/social',
            health: '/health'
        },
        documentation: 'See README.md for API documentation'
    });
});

// Rutas de la API con rate limiting
app.use('/api/auth', createRateLimit(rateLimits.auth), authRoutes);
app.use('/api/products', createRateLimit(rateLimits.api), productRoutes);
app.use('/api/orders', createRateLimit(rateLimits.api), orderRoutes);
app.use('/api/payments', createRateLimit(rateLimits.api), paymentRoutes);
app.use('/api/categories', createRateLimit(rateLimits.api), categoryRoutes);
app.use('/api/users', createRateLimit(rateLimits.strict), userRoutes);
app.use('/api/logs', createRateLimit(rateLimits.strict), logRoutes);
app.use('/api/dashboard', createRateLimit(rateLimits.api), dashboardRoutes);
app.use('/api/delivery', createRateLimit(rateLimits.api), deliveryRoutes);
app.use('/api/social', createRateLimit(rateLimits.api), socialRoutes);
app.use('/api/whatsapp', createRateLimit(rateLimits.api), whatsappRoutes);

// Manejo de rutas no encontradas
app.use(notFoundHandler);

// Manejo centralizado de errores
app.use(errorHandler);

export default app;
