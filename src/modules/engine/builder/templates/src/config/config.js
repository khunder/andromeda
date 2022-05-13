import  {AndromedaLogger} from "./andromeda-logger.js";

let config;
import {config as LoadDotEnvConfig}  from 'dotenv';
import path from 'path'
import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

LoadDotEnvConfig({path: path.join(__dirname, '../../..', '.env' )});
const Logger = new AndromedaLogger();
export class Config {
    mongoDbUri;
    tempPath;
    deploymentId

    host
    port

    socketCallBacks // list of ids of activities to associate with a common callback
    // if an id is found, we trigger a callback, this call back will communicate via ipc file socket

    static getInstance() {
        if (!config) {
           Logger.info(`creating new Config instance`)
            config = new Config();
        }
        return config;
    }

    constructor() {
        Logger.trace(`Loading Config values...`)
        this.mongoDbUri = process.env.MONGODB_URI;
        this.tempPath = process.env.tempPath || "temp";
        this.host= process.env.host || "127.0.0.1";
        this.port = process.env.port || 10000;
        this.deploymentId = process.env.deploymentId;
        if(process.env.socketCallBacks){
            this.socketCallBacks =  process.env.socketCallBacks.split(",");
        }
    }
}

export default Config;