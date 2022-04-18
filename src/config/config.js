import {AndromedaLogger} from "../config/andromeda-logger.js"
import path from 'path';
import {fileURLToPath} from 'url';
import {config as LoadDotEnvConfig} from "dotenv"

let config;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
LoadDotEnvConfig({path: path.join(__dirname, '../..', '.env' )});
const Logger = new AndromedaLogger();
export class Config {
    mongoDbUri;
    deploymentPath;
    tempPath;
    activateModules=[];
    environment
    isLocalMode

    static getInstance(force) {
        if (!config || force) {
           Logger.info(`creating new Config instance`)
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
    }
}
