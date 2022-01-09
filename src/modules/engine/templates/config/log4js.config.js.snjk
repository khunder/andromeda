const _log4jsConfig = {
  appenders: {},
  categories: {
    default: {
      appenders: [],
      level: 'trace',
    },
  },
};

_log4jsConfig.appenders.stdout = {
  type: 'stdout',
  layout: { type: 'colored' },
};

_log4jsConfig.appenders['file'] = {
  type: 'file',
  filename: 'logs/app.log',
  maxLogSize: 104857600,
  numBackups: 3,
};

_log4jsConfig.categories.default.appenders.push('stdout');
_log4jsConfig.categories.default.appenders.push('file');

module.exports= _log4jsConfig;
