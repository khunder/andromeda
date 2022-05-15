import {Stream} from "../../lib/stream.js";
import {StreamIds} from "../stream-ids.js";
import {EventStore} from "../../lib/event-store.js";
import {EventTypes} from "../../event-types.js";

export const createFlowEventDataSchema = {
    type: "object",
    properties: {
        flowId: {type: "string"}, // sequence flow id
        processInstance: {type: "string"},
        status : {type: "number"}
    },
    required: ["processInstance", "flowId", "status"],
    additionalProperties: false,
}


export class FlowEventStreamBuilder {

    /**
     *
     * @returns {Stream}
     */
    static build(){
        const stream = new Stream(StreamIds.FLOW_EVENT);
        stream.eventsRegistry =  {
            CREATE_FLOW_EVENT: EventTypes.CREATE_FLOW_EVENT,
        }
        stream.validators ={
            [stream.eventsRegistry.CREATE_FLOW_EVENT] : createFlowEventDataSchema,
        }

        EventStore.registerStream(stream.streamId, stream);
        return stream;
    }

}