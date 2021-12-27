const  AndromedaLogger = require("../config/andromeda-logger");

let config;
const LoadDotEnvConfig = require('dotenv').config;
const path = require('path')

LoadDotEnvConfig({path: path.join(__dirname, '../..', '.env' )});
const Logger = new AndromedaLogger();
class Config {
    mongoDbUri;
    deploymentPath;
    tempPath;
    activateModules=[];

    static getInstance() {
        if (!config) {
           Logger.info(`creating new Config instance`)
            config = new Config();
        }
        return config;
    }

    constructor() {

        this.mongoDbUri = process.env.MONGODB_URI;
        Logger.debug(`loading mongodbURI ${this.mongoDbUri}`)
        this.deploymentPath = process.env.deploymentPath || "deployment";
        this.tempPath = process.env.tempPath || "temp";
        this.activateModules = process.env.ACTIVE_MODULES.split(',').map( e => e.trim());
    }
}

module.exports = Config;