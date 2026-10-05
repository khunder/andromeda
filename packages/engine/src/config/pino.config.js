import pino from 'pino';
import pinoPretty from 'pino-pretty';
import path from 'path';
import fs from 'fs';
import {LogStream} from './log-stream.js';

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

        // Development configuration - pretty printing and the log file are
        // destinations of getStreams(), not transports, see there
        if (this.isPrettyMode()) {
            return baseConfig;
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

    isPrettyMode() {
        return process.env.NODE_ENV !== 'production' && process.env.isUnitTestMode !== 'true';
    }

    /**
     * Where log lines go. An in-process pino.multistream rather than
     * transport targets: transports run in a worker thread, and LogStream
     * (the SSE appender behind GET /api/logs/stream) has to live in this
     * process to reach its subscribers.
     * - dev: pretty console + logs/app.log + LogStream
     * - production / unit tests: JSON on stdout + LogStream
     */
    getStreams() {
        const logLevel = process.env.LOG_LEVEL || 'trace';
        const streams = [];
        if (this.isPrettyMode()) {
            streams.push({
                level: logLevel,
                stream: pinoPretty({
                    colorize: true,
                    translateTime: 'yyyy-mm-dd HH:MM:ss.l',
                    ignore: 'pid,hostname,application,ENV,ip'
                })
            });
            streams.push({
                level: logLevel,
                stream: pino.destination({
                    dest: path.join(process.cwd(), 'logs', 'app.log'),
                    mkdir: true,
                    sync: false
                })
            });
        } else {
            streams.push({level: logLevel, stream: process.stdout});
        }
        streams.push({level: logLevel, stream: LogStream.getInstance()});
        return pino.multistream(streams);
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
