import pino from 'pino';
import path from 'path';
import fs from 'fs';

/**
 * Pino Logger Configuration
 * Replaces log4js with a more performant and ESM-friendly logger
 */
export class PinoConfig {
    constructor() {
        // Ensure logs directory exists
        const logsDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
    }

    getConfig() {
        const isDevelopment = process.env.NODE_ENV !== 'production';
        const logLevel = process.env.LOG_LEVEL || 'trace';

        // Base configuration
        const baseConfig = {
            level: logLevel,
            base: {
                application: 'engine',
                pid: process.pid,
                ...(process.env.IP && { ip: process.env.IP }),
                ...(process.env.ENV && { ENV: process.env.ENV })
            },
            timestamp: pino.stdTimeFunctions.isoTime
        };

        // Development configuration with pretty printing
        if (isDevelopment && process.env.isUnitTestMode !== 'true') {
            return {
                ...baseConfig,
                transport: {
                    targets: [
                        {
                            target: 'pino-pretty',
                            level: logLevel,
                            options: {
                                colorize: true,
                                translateTime: 'yyyy-mm-dd HH:MM:ss.l',
                                ignore: 'pid,hostname'
                            }
                        },
                        {
                            target: 'pino/file',
                            level: logLevel,
                            options: {
                                destination: path.join(process.cwd(), 'logs', 'app.log'),
                                mkdir: true
                            }
                        }
                    ]
                }
            };
        }

        // Production configuration - can use formatters here
        return {
            ...baseConfig,
            formatters: {
                level: (label) => {
                    return { level: label.toUpperCase() };
                }
            }
        };
    }

    /**
     * Create a file transport for production use
     */
    getFileTransport() {
        return pino.transport({
            target: 'pino/file',
            options: {
                destination: path.join(process.cwd(), 'logs', 'app.log'),
                mkdir: true
            }
        });
    }
}

export default PinoConfig;
