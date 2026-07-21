import pino from 'pino';
import PinoConfig from './pino.config.js';

// Create singleton logger instance
const pinoConfig = new PinoConfig();
const defaultLogger = pino(pinoConfig.getConfig());

/**
 * AndromedaLogger - Wrapper around Pino logger for backward compatibility
 * Provides the same interface as the old log4js-based logger
 */
export class AndromedaLogger {
    logger;
    name;

    constructor(name, config) {
        if (name) {
            this.name = name;
            // Create a child logger with the specific name
            this.logger = defaultLogger.child({ name });
        } else {
            this.logger = defaultLogger.child({ name: 'engine' });
        }
        
        // If custom config provided, create new logger instance
        if (config) {
            this.logger = pino(config);
        }
    }

    info(message) {
        if (this.isObject(message)) {
            this.logger.info(message);
        } else {
            this.logger.info(message);
        }
    }

    isObject(val) {
        return typeof val === 'object' && val !== null;
    }

    error(message, trace) {
        if (this.isObject(message)) {
            this.logger.error(
                { 
                    err: message,
                    trace: trace || message.stack 
                },
                message.message || String(message)
            );
        } else {
            if (trace) {
                this.logger.error({ trace }, message);
            } else {
                this.logger.error(message);
            }
        }
    }

    warn(message) {
        if (this.isObject(message)) {
            this.logger.warn(message);
        } else {
            this.logger.warn(message);
        }
    }

    debug(message, context) {
        if (context) {
            this.logger.debug({ context }, message);
        } else if (this.isObject(message)) {
            this.logger.debug(message);
        } else {
            this.logger.debug(message);
        }
    }

    trace(message, context) {
        if (context) {
            this.logger.trace({ context }, message);
        } else if (this.isObject(message)) {
            this.logger.trace(message);
        } else {
            this.logger.trace(message);
        }
    }

    fatal(message, context) {
        if (context) {
            this.logger.fatal({ context }, message);
        } else if (this.isObject(message)) {
            this.logger.fatal(message);
        } else {
            this.logger.fatal(message);
        }
    }

    child(bindings) {
        const childLogger = new AndromedaLogger();
        childLogger.logger = this.logger.child(bindings || {});
        return childLogger;
    }
}

