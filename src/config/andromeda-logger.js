
import log4js  from "log4js"

import Log4jsConfig from "./log4js.config.js"

log4js.addLayout('json', function (config) {
    return function (logEvent) {
        logEvent.application = 'engine';
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
const log = log4js.getLogger('engine');
log4js.configure(new Log4jsConfig().getConfig());

export class AndromedaLogger {
    logger;
    name;

    constructor(name, config) {
        if(name){
            this.name=name;
            this.logger =  log4js.getLogger(name);;
        }else {
            this.logger = log;
        }
        if(config){ // force configuration refresh
            log4js.configure(config);
        }

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

export  default  AndromedaLogger;