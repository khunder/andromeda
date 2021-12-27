

let AndromedaLogger =  require("../config/andromeda-logger");
let fastify = require('fastify');
const fastify_swagger = require('fastify-swagger')
let options=  require("../config/swagger");
const Logger = new AndromedaLogger();
let path = require('path');
let autoload = require('fastify-autoload');
const GracefulServer =require("@gquittet/graceful-server");


class Engine {

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
        this.app.register(autoload, {
            fastify_swagger,
            dir: path.join(__dirname, '../routes'),
        })
    }


    getApp(){
        return this.app;
    }

    // start the server!
    start = async (port) => {
        let startTime = new Date().getMilliseconds();
        try {
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

module.exports= Engine