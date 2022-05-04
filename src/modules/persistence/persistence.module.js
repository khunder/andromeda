 import mongoose from "mongoose";
import {Config} from "../../config/config.js";
import {AndromedaLogger} from "../../config/andromeda-logger.js";
 import {ProcessInstanceProjection} from "./event-store/projections/process-instance-projection.js";
 import {Stream} from "./event-store/streams/stream.js";
 import {ProcessInstanceStreamBuilder} from "./event-store/streams/process-instance/process-instance.stream-builder.js";

const Logger = new AndromedaLogger();

export class PersistenceModule {

    constructor() {

    }


    static async init() {
        return new Promise( (async (resolve, reject) => {
            try {
                Logger.info(`Mongoose trying to connect...`)
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
                PersistenceModule.registerStreams();
                resolve();
            }catch (e) {
                Logger.error(e)
                reject(e)
            }
        }));

    }

    static registerStreams(){
        const stream = new ProcessInstanceStreamBuilder().build()
        this.registerProjections(stream, stream.eventsRegistry.CREATE_PROCESS_INSTANCE, new ProcessInstanceProjection());
        this.registerProjections(stream, stream.eventsRegistry.CLOSE_PROCESS_INSTANCE, new ProcessInstanceProjection());
    }

    /**
     *
     * @param {Stream} stream
     * @param {string} eventType
     * @param projector
     */
    static registerProjections(stream, eventType, projector){
        stream.projections[eventType] =projector;
    }

    static async dispose(){
        await mongoose.disconnect()
    }

}

export default PersistenceModule;