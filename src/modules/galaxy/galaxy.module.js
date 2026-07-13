import fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import autoload from '@fastify/autoload';
import path from 'path';
import {fileURLToPath} from 'url';
import {Config} from '../../config/config.js';
import {AndromedaLogger} from "../../config/andromeda-logger.js";
const Logger = new AndromedaLogger();

export class GalaxyModule {
    constructor(host, port){
        this.host = host || (process.env.GALAXY_HOST || '127.0.0.1');
        this.port = port || (process.env.GALAXY_PORT || '5001');
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        this.app = fastify({ logger: false });
        this.app.register(fastifyCors, { origin: true });
        this.app.register(autoload, { dir: path.join(__dirname, '../../routes') });
    }

    start(){
        return new Promise(async (resolve, reject)=>{
            try{
                await this.app.listen({ host: this.host, port: Number(this.port) });
                Logger.info(`Galaxy listening on ${this.host}:${this.port}`)
                resolve();
            }catch(e){
                reject(e);
            }
        })
    }
}

export default GalaxyModule;
