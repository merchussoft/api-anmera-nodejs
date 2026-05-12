import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    message?: string;
}

interface RateLimitStore {
    [key: string]: {
        count: number;
        resetTime: number;
    };
}

class RateLimiter {
    private store: RateLimitStore;
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        this.store = {};
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    private cleanup(): void {
        const now = Date.now();
        for (const key in this.store) {
            if (this.store[key].resetTime < now) {
                delete this.store[key];
            }
        }
    }

    public middleware(config: RateLimitConfig) {
        return (req: Request, res: Response, next: NextFunction) => {
            const key = this.getKey(req);
            const now = Date.now();
            const record = this.store[key];

            if (!record || record.resetTime < now) {
                this.store[key] = {
                    count: 1,
                    resetTime: now + config.windowMs
                };
                return next();
            }

            if (record.count >= config.maxRequests) {
                const resetTimeRemaining = Math.ceil((record.resetTime - now) / 1000);
                res.setHeader('Retry-After', resetTimeRemaining.toString());
                res.status(429).json({
                    success: false,
                    message: config.message || 'Too many requests',
                    statusCode: 429,
                    retryAfter: resetTimeRemaining
                });
                return;
            }

            record.count++;
            next();
        };
    }

    private getKey(req: Request): string {
        const ip = req.headers['x-forwarded-for'] as string ||
            req.headers['x-real-ip'] as string ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            'unknown';
        const path = req.path;
        return `${ip}:${path}`;
    }

    public reset(key: string): void {
        delete this.store[key];
    }

    public getStats(): { totalEntries: number; keys: string[] } {
        return {
            totalEntries: Object.keys(this.store).length,
            keys: Object.keys(this.store)
        };
    }

    public clear(): void {
        this.store = {};
    }
}

const rateLimiter = new RateLimiter();

export const createRateLimit = (config: RateLimitConfig) => rateLimiter.middleware(config);

export const rateLimits = {
    auth: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 5,
        message: 'Too many login attempts, please try again later'
    },
    api: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 500,
        message: 'Too many API requests, please try again later'
    },
    strict: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 100,
        message: 'Too many requests from this IP'
    }
};

export default rateLimiter;
