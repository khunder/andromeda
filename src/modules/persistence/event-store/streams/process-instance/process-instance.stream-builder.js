import {Stream} from "../stream.js";
import {StreamAggregatorIds} from "../stream-aggregator-ids.js";
import {EventStore} from "../../event-store.js";

export const processInstanceDataSchema = {
    type: "object",
    properties: {
        id: {type: "string"},
        deploymentId: {type: "string"},
        processDef: {type: "string"},
        containerId: {type: "string"},
        status: {type: "integer"},
    },
    required: ["id", "deploymentId", "processDef", "containerId", "status"],
    additionalProperties: false,
}

export class ProcessInstanceStreamBuilder {

    /**
     *
     * @returns {Stream}
     */
    build(){
        const stream = new Stream(StreamAggregatorIds.PROCESS_INSTANCE);
        stream.eventsRegistry =  {
            CREATE_PROCESS_INSTANCE: "CREATE_PROCESS_INSTANCE",
            CLOSE_PROCESS_INSTANCE: "CLOSE_PROCESS_INSTANCE"
        }
        stream.validators ={[stream.eventsRegistry.CREATE_PROCESS_INSTANCE] : processInstanceDataSchema}

        EventStore.registerStream(stream.streamId, stream);
        return stream;
    }

}