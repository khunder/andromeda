// Require external modules
import mongoose from "mongoose";

import {Config} from "./config/config.js";
import {AndromedaLogger} from "./config/andromeda-logger.js";
import {ContainerContext} from "./model/container.context.js";

const Logger = new AndromedaLogger();

export class Engine {

    // start the server!
    start = async (backend, port) => {
        try {
            let startTime = new Date().getMilliseconds();
            await mongoose.connect(Config.getInstance().mongoDbUri);
            await backend.listen(port, "0.0.0.0")
            backend.swagger()
            Logger.info(`server listening on ${backend.server.address().port}`)
            let startCompleted = new Date().getMilliseconds();
            Logger.info(`Engine started in ${startCompleted - startTime} ms`)
        } catch (err) {
            Logger.error(err)
            process.exit(1)
        }
    }

    stop = async(backend) => {
        try {
            let startTime = new Date().getMilliseconds();
            await mongoose.disconnect()
            await backend.close();
            backend.log.info(`server stopped `)
            let startCompleted = new Date().getMilliseconds();
            console.log(`Engine stopped in ${startCompleted - startTime} ms`)
        } catch (err) {
            Logger.error(err)
            process.exit(1)
        }
    }


}
