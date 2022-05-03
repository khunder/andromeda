import {StreamAggregatorIds} from "../stream-aggregator-ids.js";
import AndromedaLogger from "../../../../../config/andromeda-logger.js";
const Logger = new AndromedaLogger();

export class ProcessInstanceStream {
    static streamId = StreamAggregatorIds.PROCESS_INSTANCE

    static events = {
        CREATE_PROCESS_INSTANCE: "CREATE_PROCESS_INSTANCE",
        CLOSE_PROCESS_INSTANCE: "CLOSE_PROCESS_INSTANCE",
    }

    aggregate(event){
        switch (event.type){
            case ProcessInstanceStream.events.CREATE_PROCESS_INSTANCE:
                break;
            default:
                throw new Error(`event type (${event.type}) not supported `)
        }
    }
}