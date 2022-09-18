import {AndromedaLogger} from "../config/andromeda-logger.js"
import Utils from "../utils/utils.js";
import path from "path";


let config

const Logger = new AndromedaLogger();
export class Config {
    mongoDbUri;
    deploymentPath;
    tempPath;
    activateModules=[];
    environment
    host
    port

    isLocalMode
    isUnitTestMode

    static getInstance(force) {
        if (!config || force) {
            Logger.info(`creating new Config instance`)
            Utils.loadEnvVariables();
            config = new Config();
        }
        return config;
    }

    constructor() {
        Logger.trace(`Loading Config values...`)
        this.mongoDbUri = process.env.MONGODB_URI;
        this.deploymentPath = process.env.deploymentPath || path.join(process.cwd(), "deployments");
        this.tempPath = process.env.tempPath || "temp";
        this.activateModules = process.env.ACTIVE_MODULES.split(',').map( e => e.trim());
        this.environment = process.env.ENV || "local";
        this.isLocalMode= this.environment === "local";
        this.isUnitTestMode= process.env.isUnitTestMode === "true";
        this.host= process.env.host || "127.0.0.1";
        this.port= process.env.port || "5000";
    }
}
