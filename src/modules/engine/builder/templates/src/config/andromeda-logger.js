import log4js from  "log4js";

import log4jsConfig from "./log4js.config.js";

log4js.addLayout('json', function (config) {
    return function (logEvent) {
        // logEvent.app = ContainerService.getInstance().containerId || "container";
        logEvent.processId = process.pid;
        if (process.env.IP) {
            logEvent.ip = process.env.IP;
        }
        if (process.env.ENV) {
            logEvent.ENV = process.env.ENV;
        }
        if (logEvent.data && logEvent.data.length > 0) {
            logEvent.message = logEvent.data[0];
            delete logEvent.data;
        }
        return JSON.stringify(logEvent);
    };
});
const logSingleton = log4js.getLogger('container');

log4js.configure(log4jsConfig);

export class AndromedaLogger {
    logger;
    loggerOptions;

    constructor(args) {
        this.logger = logSingleton;
    }

    get Logger() {
        return this.logger;
    }

    static configGlobal(options) {
        this.loggerOptions = options;
    }

    info(message) {
        this.logger.info(message);
    }

    isObject(val) {
        return (typeof val === 'object');
    }

    error(message, trace) {
        if(this.isObject(message)){
            this.logger.error(`${message.message || ''} -> (${trace || message.stack || 'trace not provided !'})`);
        }else{
            this.logger.error(`${message} -> (${trace || 'trace not provided !'})`);
        }
    }

    warn(message) {
        this.logger.warn(message);
    }

    debug(message, context) {
        this.logger.debug(message);
    }

    trace(message, context) {
        this.logger.trace(message);
    }

    fatal(message, context) {
        this.logger.fatal(message);
    }

    child() {
        return new AndromedaLogger()
    };


}
export default AndromedaLogger;