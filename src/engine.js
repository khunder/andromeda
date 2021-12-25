// Require external modules
import mongoose from "mongoose";

import {Config} from "./config/config.js";
import {AndromedaLogger} from "./config/andromeda-logger.js";
import fastify from "fastify";
import fastify_swagger from "fastify-swagger";
import {options} from "./config/swagger.js";
const Logger = new AndromedaLogger();
import { join } from 'path';
import * as autoLoad from 'fastify-autoload'
import GracefulServer from "@gquittet/graceful-server";
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export class Engine {

    app = fastify({
        logger: Logger
    });
    gracefulServer = GracefulServer(this.app.server)

    constructor() {



        this.gracefulServer.on(GracefulServer.READY, () => {
            Logger.info('Server is ready')
        })

        this.gracefulServer.on(GracefulServer.SHUTTING_DOWN, () => {
            Logger.info('Server is shutting down')
        })

        this.gracefulServer.on(GracefulServer.SHUTDOWN, error => {
            Logger.info(`Server is down because of ${error.message}`)
        })

        this.app.register(fastify_swagger, options)
        this.app.register(autoLoad, {
            fastify_swagger,
            dir: join(__dirname, 'routes'),
        })
    }


    getApp(){
        return this.app;
    }

    // start the server!
    start = async (port) => {
        let startTime = new Date().getMilliseconds();
        try {
            await mongoose.connect(Config.getInstance().mongoDbUri);
            await this.app.listen(port, "0.0.0.0")
            this.app.swagger()
            let startCompleted = new Date().getMilliseconds();
            Logger.info(`Engine started in ${startCompleted - startTime} ms`)
            this.gracefulServer.setReady()
            return this.app;
        } catch (err) {
            Logger.error(err)
            process.exit(1)
        }
    }

}
