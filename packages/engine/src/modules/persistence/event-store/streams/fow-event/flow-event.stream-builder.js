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

// used for close and abort process instance
export const updateFlowEventDataSchema = {
    type: "object",
    properties: {
        flowId: {type: "string"}, // sequence flow id
        processInstance: {type: "string"},
    },
    required: ["processInstance", "flowId"],
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
            CLOSE_FLOW_EVENT: EventTypes.CLOSE_FLOW_EVENT,
            ABORT_FLOW_EVENT: EventTypes.ABORT_FLOW_EVENT,
            FAIL_FLOW_EVENT: EventTypes.FAIL_FLOW_EVENT,
        }
        stream.validators ={
            [stream.eventsRegistry.CREATE_FLOW_EVENT] : createFlowEventDataSchema,
            [stream.eventsRegistry.CLOSE_FLOW_EVENT] : updateFlowEventDataSchema,
            [stream.eventsRegistry.ABORT_FLOW_EVENT] : updateFlowEventDataSchema,
            [stream.eventsRegistry.FAIL_FLOW_EVENT] : updateFlowEventDataSchema,
        }

        EventStore.registerStream(stream.streamId, stream);
        return stream;
    }

}