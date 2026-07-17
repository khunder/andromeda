import { AndromedaLogger } from "../../../../config/andromeda-logger.js";

const Logger = new AndromedaLogger();



export class Stream {

    // id used to route messages to this stream of events
    streamId
    projections = {}
    streamPosition = 0;
    eventsRegistry = {}
    validators = {}


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
