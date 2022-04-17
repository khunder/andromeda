
export class Log4jsConfig{

  _log4jsConfig = {
    appenders: {},
    categories: {
      default: {
        appenders: [],
        level: 'trace',
      },
    },
  };

  constructor() {
    this._log4jsConfig.appenders.console = {
      type: 'stdout',
      layout: { type: 'colored' },
    };

    this._log4jsConfig.appenders['file'] = {
      type: 'file',
      filename: 'logs/app.log',
      maxLogSize: 104857600,
      numBackups: 3,
    };


    this._log4jsConfig.categories.default.appenders.push('console');
    this._log4jsConfig.categories.default.appenders.push('file');

  }

  getConfig(){
    return this._log4jsConfig;
  }


}

export default Log4jsConfig;
