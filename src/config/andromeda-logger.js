import log4js from "log4js";

import {log4jsConfig} from "./log4js.config.js";

log4js.addLayout('json', function (config) {
  return function (logEvent) {
    logEvent.application = 'engine';
    logEvent.processId = process.pid;
    if (process.env.realm) {
      logEvent.realm = process.env.realm;
    }
    if (process.env.IP) {
      logEvent.ip = process.env.IP;
    }
    if (process.env.ENV) {
      logEvent.realm = process.env.ENV;
    }
    if (logEvent.data && logEvent.data.length > 0) {
      logEvent.message = logEvent.data[0];
      delete logEvent.data;
    }
    return JSON.stringify(logEvent);
  };
});
const log = log4js.getLogger('engine');

log4js.configure(log4jsConfig);

export class AndromedaLogger {
   logger;
   loggerOptions;

  constructor() {
    this.logger = log;
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
  error(message, trace) {
    this.logger.error(`${message} -> (${trace || 'trace not provided !'})`);
  }
  warn(message) {
    this.logger.warn(message);
  }

  debug(message, context) {
    this.logger.debug(message);
  }
  verbose(message, context) {
    this.logger.trace(message);
  }
}
