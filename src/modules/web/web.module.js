import {fileURLToPath} from "url";
import path from "path";
import fastify from "fastify";
import GracefulServer from "@gquittet/graceful-server";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUI from "@fastify/swagger-ui";
import fastifyCors from "@fastify/cors";
import multipart from "@fastify/multipart";
import autoload from "@fastify/autoload";

import {AndromedaLogger} from "../../config/andromeda-logger.js";
import {Config} from "../../config/config.js";
import fs from "fs";
import {App} from "../../../app.js";
import Utils from "../../utils/utils.js";
const Logger = new AndromedaLogger();


export class WebModule {

    app
    gracefulServer
    host
    port

    constructor(host, port) {
        this.host=host
        this.port=port
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);


        this.app = fastify({ logger: null })
        this.gracefulServer = GracefulServer(this.app.server)

        // Configure CORS to allow requests from frontend
        this.app.register(fastifyCors, {
            origin: (origin, cb) => {
                // Allow requests from localhost:3000 (your frontend)
                const allowedOrigins = [
                    'http://localhost:3000',
                    'http://localhost:3001',
                    'http://localhost:5173', // Vite default port
                    'http://127.0.0.1:3000',
                    'http://127.0.0.1:3001',
                    'http://127.0.0.1:5173'
                ];
                
                // Allow requests with no origin (like mobile apps or Postman)
                if (!origin || allowedOrigins.includes(origin)) {
                    cb(null, true);
                } else {
                    cb(null, false);
                }
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            // Allow all headers - you can restrict this in production
            allowedHeaders: ['*'],
            exposedHeaders: ['*']
        });

        // Register the OpenAPI spec (served as JSON)
        this.app.register(fastifySwagger, {
            mode: "static",
            hideUntagged: true,
            openapi: '3.0.3',
            specification: {
                // Resolve from the running container directory so it works in generated deployments
                path: path.resolve(process.cwd(), 'specification.yaml')
            }
        })

        // Serve the Swagger UI at /api
        this.app.register(fastifySwaggerUI, {
            routePrefix: '/api',
            uiConfig: {
                docExpansion: 'none',
                deepLinking: false
            },
            staticCSP: true,
            transformStaticCSP: (header) => header,
            // ensure route is exposed
            exposeRoute: true
        })

        this.app.setErrorHandler(async (error, req, reply) => {
            Logger.error(error)
            Logger.error(req)
            Logger.error(reply)
            reply.status(500)
            reply.send()
        })


        this.gracefulServer.on(GracefulServer.READY, () => {
            Logger.info('Server is ready');
            fs.writeFileSync(Utils.getSocketPath(), process.pid.toString());
        })

        this.gracefulServer.on(GracefulServer.SHUTTING_DOWN, async () => {
            Logger.info('Server is shutting down')
            try {
                fs.unlinkSync(Utils.getSocketPath());
                await App.close()

            } catch (e) {
                Logger.warn(`GracefulServer SHUTTING_DOWN cannot delete pid file`)
            }
        })

        this.gracefulServer.on(GracefulServer.SHUTDOWN, error => {
            Logger.info(`Server is down because of ${error.message}`)
        })

        // Register multipart support for file uploads
        this.app.register(multipart, {
            limits: {
                fieldNameSize: 100, // Max field name size in bytes
                fieldSize: 1000000, // Max field value size in bytes
                fields: 10, // Max number of non-file fields
                fileSize: 10000000, // 10 MB - max file size
                files: 10, // Max number of file fields
                headerPairs: 2000 // Max number of header key=>value pairs
            }
        })

        this.app.register(autoload, {
            dir: path.join(__dirname, '../../routes'),
        });
    }

    start(){
        let startTime = new Date().getUTCMilliseconds();
        return new Promise((async (resolve, reject) => {
            try {
                await this.app.listen({ port: this.port, host: this.host })
                // Ensure the swagger JSON is generated and ready
                await this.app.swagger()
                let startCompleted = new Date().getUTCMilliseconds();
                Logger.info(`Engine started to listen at port ${this.port}, (${Config.getInstance().environment} mode)`)
                this.gracefulServer.setReady()
                resolve(this.app);
            } catch (err) {
                Logger.error(err)
                reject(err)
            }
        }))
    }
}
