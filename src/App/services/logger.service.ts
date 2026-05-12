import prisma from '../../config/database';

export type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'SUCCESS';

export class LoggerService {
    static async log(
        level: LogLevel,
        action: string,
        message: string,
        metadata?: Record<string, any>
    ): Promise<void> {
        try {
            await prisma.systemLog.create({
                data: {
                    level,
                    action,
                    message,
                    metadata: metadata ? JSON.stringify(metadata) : null
                }
            });

            if (process.env.NODE_ENV === 'development') {
                const color = level === 'INFO' ? '\x1b[32m' :
                    level === 'ERROR' ? '\x1b[31m' :
                        level === 'WARN' ? '\x1b[33m' :
                            '\x1b[32m';

                console.log(`${color}${level}] ${action}: ${message}`, metadata || '');
            }
        } catch (error) {
            console.error('Error writing to system log:', error);
        }
    }

    static async info(action: string, message: string, metadata?: Record<string, any>) {
        return this.log('INFO', action, message, metadata);
    }

    static async success(action: string, message: string, metadata?: Record<string, any>) {
        return this.log('SUCCESS', action, message, metadata);
    }

    static async error(action: string, message: string, metadata?: Record<string, any>) {
        return this.log('ERROR', action, message, metadata);
    }

    static async warn(action: string, message: string, metadata?: Record<string, any>) {
        return this.log('WARN', action, message, metadata);
    }
}