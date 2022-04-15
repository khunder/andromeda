import mongoose from "mongoose";
import {Config} from "../../config/config.js";
import {AndromedaLogger} from "../../config/andromeda-logger.js";

const Logger = new AndromedaLogger();

export class PersistenceModule {

    constructor() {

    }

    static async init() {
        return new Promise( (async (resolve, reject) => {
            try {
                Logger.info(`Trying to start Mongoose`)
                await mongoose.connect(Config.getInstance().mongoDbUri, {
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                    // useFindAndModify: false,
                    // useCreateIndex: true,
                    // reconnectTries: 30,
                    keepAlive: true,
                    //poolSize: 30,

                });
                Logger.info(`Mongoose connected`)
                resolve();
            }catch (e) {
                Logger.error(e)
                reject(e)
            }
        }));

    }

    static async dispose(){
        await mongoose.disconnect()
    }

}

export default PersistenceModule;