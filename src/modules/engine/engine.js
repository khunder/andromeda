import {AndromedaLogger} from "../../config/andromeda-logger.js";
import path from "path";
import fastify from "fastify";
import GracefulServer from "@gquittet/graceful-server";
import multer from "fastify-multer";
import fastifySwagger from 'fastify-swagger';
import autoload from 'fastify-autoload';
import {fileURLToPath} from "url";

const Logger = new AndromedaLogger();


class Engine {

    app = fastify({ logger: Logger })

    gracefulServer = GracefulServer(this.app.server)

    constructor() {

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);

        this.app.register(fastifySwagger, {
            mode: "static",
            routePrefix: '/api',
            hideUntagged: true,
            openapi: '3.0.3',
            specification: {
                path: './specification.yaml'
            },
            exposeRoute: true
        })


        this.gracefulServer.on(GracefulServer.READY, () => {
            Logger.info('Server is ready')
        })

        this.gracefulServer.on(GracefulServer.SHUTTING_DOWN, () => {
            Logger.info('Server is shutting down')
        })

        this.gracefulServer.on(GracefulServer.SHUTDOWN, error => {
            Logger.info(`Server is down because of ${error.message}`)
        })

        // this.app.register(multer.contentParser, {addToBody: true})
        this.app.register(multer.contentParser)

        this.app.register(autoload, {
            dir: path.join(__dirname, '../../routes'),
        });

    }


    getApp() {
        return this.app;
    }

    // start the server!
    start = async (host, port) => {
        let startTime = new Date().getMilliseconds();
        try {
            await this.app.listen(port, host)
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

export  default  Engine;