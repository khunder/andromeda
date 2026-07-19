import { AndromedaLogger } from "../../../../config/andromeda-logger.js";

const Logger = new AndromedaLogger();



export class Stream {

    // id used to route messages to this stream of events
    streamId
    projections = {}
    streamPosition = 0;
    eventsRegistry = {}
    validators = {}

    // object exposing captureState/restoreState/reset for the stream's read
    // model , required for snapshots and replay (set by PersistenceGateway)
    snapshotHandler = null
    // persist a snapshot every N events; 0 disables automatic snapshots
    snapshotFrequency = 0


    constructor(streamId) {
        this.streamId = streamId;
    }

    async dispatch(event) {
        Logger.trace(`dispatching event ${JSON.stringify(event)}`)
        if (event.type in this.projections){
            await this.projections[event.type].process(event)
        }

    }
}
