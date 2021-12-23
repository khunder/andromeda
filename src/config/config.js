let config;
import { config as LoadDotEnvConfig } from 'dotenv';
LoadDotEnvConfig({path: '../.env'});

export class Config {
    mongoDbUri;
    deploymentPath;
    tempPath;

    static getInstance() {
        if (!config) {
            config = new Config();
        }
        return config;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    constructor() {
        this.mongoDbUri = process.env.MONGODB_URI;
        this.deploymentPath = process.env.deploymentPath || "deployment";
        this.tempPath = process.env.tempPath || "temp";
    }
}
