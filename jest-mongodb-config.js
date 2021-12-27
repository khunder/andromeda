module.exports = {
  mongodbMemoryServerOptions: {
    binary: {
      version: '5.0.3',
      skipMD5: true,
    },
    instance: {
      dbName: 'Andromeda',
      port: 27027,
      storageEngine: 'ephemeralForTest',
    },
  },
};
