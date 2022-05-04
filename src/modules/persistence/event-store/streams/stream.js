import AndromedaLogger from "../../../../config/andromeda-logger.js";

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

    get streamPosition() {
        return this.streamPosition
    }
    set streamPosition(value) {
        this.streamPosition = value
    }


    dispatch(event) {

        if (event.type in this.projections){
            this.projections[event.type].process(event)
        }

    }
}