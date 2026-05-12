import dotenv from 'dotenv';

dotenv.config();

interface Config {
    port: number;
    nodeEnv: string;
    databaseUrl: string;
    jwtSecret: string;
    jwtExpiresIn: string;
    frontendUrl: string;
    paymentProvider: 'wompi' | 'mock';
    wompiPubKey: string;
    wompiPrvKey: string;
    wompiIntegritySecret: string;
    wompiEventSecret: string;
    supabaseUrl: string;
    supabaseKey: string;
    s3BucketName: string;
    apiVersion: string;
}

const config: Config = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL || '',
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    paymentProvider: (process.env.PAYMENT_PROVIDER as 'wompi' | 'mock') || 'wompi',
    wompiPubKey: process.env.WOMPI_PUBLIC_KEY || process.env.WOMPI_PUB_KEY || '',
    wompiPrvKey: process.env.WOMPI_PRIVATE_KEY || process.env.WOMPI_PRV_KEY || '',
    wompiIntegritySecret: process.env.WOMPI_INTEGRITY_SECRET || process.env.WOMPI_PRIVATE_KEY || '',
    wompiEventSecret: process.env.WOMPI_EVENT_SECRET || '',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '',
    s3BucketName: process.env.S3_BUCKET_NAME || 'anmeraStore',
    apiVersion: 'v1'
};


// Validaciones en producción
if (config.nodeEnv === 'production') {
    if (config.jwtSecret === 'your-secret-key-change-in-production') {
        console.error('❌ ERROR: JWT_SECRET must be set in production');
        process.exit(1);
    }

    if (!config.databaseUrl) {
        console.error('❌ ERROR: DATABASE_URL must be set in production');
        process.exit(1);
    }

    if ((!config.wompiPubKey || !config.wompiIntegritySecret) && config.paymentProvider === 'wompi') {
        console.warn('⚠️  WARNING: Wompi credentials not fully configured');
    }
}

export default config;
