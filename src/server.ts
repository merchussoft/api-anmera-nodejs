import app from './app';
import config from './config/env';
import './config/database';

const server = app.listen(config.port, () => {
    console.log('');
    console.log('🚀 AnmeraStore API Server (TypeScript + Prisma)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📡 Server running on port: ${config.port}`);
    console.log(`🌍 Environment: ${config.nodeEnv}`);
    console.log(`🔗 API URL: http://localhost:${config.port}`);
    console.log(`💳 Payment Provider: ${config.paymentProvider}`);
    console.log(`🎨 Frontend URL: ${config.frontendUrl}`);
    console.log(`🗄️  Database: PostgreSQL/MySQL with Prisma ORM`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📚 Available endpoints:');
    console.log('   GET  /health');
    console.log('   POST /api/auth/register');
    console.log('   POST /api/auth/login');
    console.log('   GET  /api/products');
    console.log('   GET  /api/products/:id');
    console.log('   POST /api/orders');
    console.log('   POST /api/payments/create-session');
    console.log('   POST /api/payments/webhook/mercadopago');
    console.log('   POST /api/payments/webhook/wompi');
    console.log('');
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err: Error) => {
    console.error('❌ Unhandled Rejection:', err);
    server.close(() => process.exit(1));
});

process.on('uncaughtException', (err: Error) => {
    console.error('❌ Uncaught Exception:', err);
    server.close(() => process.exit(1));
});

// Manejo de señales de terminación
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('👋 SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

export default server;
