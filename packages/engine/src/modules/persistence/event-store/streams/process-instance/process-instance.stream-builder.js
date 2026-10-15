import {Stream} from "../../lib/stream.js";
import {StreamIds} from "../stream-ids.js";
import {EventStore} from "../../lib/event-store.js";

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

export const closeProcessInstanceDataSchema = {
    type: "object",
    properties: {
        id: {type: "string"},
        containerId: {type: "string"},
    },
    required: ["id"],
    additionalProperties: false,
}


// the reason stays in the event log - the read model only records status Error
export const failProcessInstanceDataSchema = {
    type: "object",
    properties: {
        id: {type: "string"},
        reason: {type: "string"},
    },
    required: ["id"],
    additionalProperties: false,
}


export class ProcessInstanceStreamBuilder {

    /**
     *
     * @returns {Stream}
     */
    static build(){
        const stream = new Stream(StreamIds.PROCESS_INSTANCE);
        stream.eventsRegistry =  {
            CREATE_PROCESS_INSTANCE: "CREATE_PROCESS_INSTANCE",
            CLOSE_PROCESS_INSTANCE: "CLOSE_PROCESS_INSTANCE",
            FAIL_PROCESS_INSTANCE: "FAIL_PROCESS_INSTANCE"
        }
        stream.validators ={
            [stream.eventsRegistry.CREATE_PROCESS_INSTANCE] : processInstanceDataSchema,
            [stream.eventsRegistry.CLOSE_PROCESS_INSTANCE] : closeProcessInstanceDataSchema,
            [stream.eventsRegistry.FAIL_PROCESS_INSTANCE] : failProcessInstanceDataSchema,
        }

        EventStore.registerStream(stream.streamId, stream);
        return stream;
    }

}