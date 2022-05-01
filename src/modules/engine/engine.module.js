import {AndromedaLogger} from "../../config/andromeda-logger.js";
import path from "path";
import fastify from "fastify";
import GracefulServer from "@gquittet/graceful-server";
import multer from "fastify-multer";
import fastifySwagger from '@fastify/swagger';
import autoload from '@fastify/autoload';
import {fileURLToPath} from "url";
import {Config} from "../../config/config.js";
import {EmbeddedSidecarDaemonService} from "./embedded/embedded.sidecar.daemon.service.js";

const Logger = new AndromedaLogger();


export class EngineModule {

    app
    gracefulServer
    host
    port

    constructor(host, port) {
        this.host=host
        this.port=port
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);


        this.app = fastify({ logger: Logger })
        this.gracefulServer = GracefulServer(this.app.server)

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
    start  ()  {
        let startTime = new Date().getUTCMilliseconds();
        return new Promise((async (resolve, reject) => {
            try {
                await this.app.listen(this.port, this.host)
                this.app.swagger()
                let startCompleted = new Date().getUTCMilliseconds();
                Logger.info(`Engine started in ${startCompleted - startTime} ms, (${Config.getInstance().environment} mode)`)
                this.gracefulServer.setReady()
                if (Config.getInstance().isLocalMode) {
                    const daemon = await import("./embedded/embedded.sidecar.daemon.service.js");
                    daemon.EmbeddedSidecarDaemonService.initDaemon();
                }
                resolve(this.app);
            } catch (err) {
                Logger.error(err)
                reject(err)
            }
        }))
    }

}

export  default  EngineModule;