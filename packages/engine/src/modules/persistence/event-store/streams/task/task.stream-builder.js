import {Stream} from "../../lib/stream.js";
import {StreamIds} from "../stream-ids.js";
import {EventStore} from "../../lib/event-store.js";
import {EventTypes} from "../../event-types.js";
import {TaskType} from "../../internal/models/task.orm-model.js";

export const createTaskDataSchema = {
    type: "object",
    properties: {
        deploymentId: {type: "string"},
        processDef: {type: "string"},
        processInstance: {type: "string"},
        nodeId: {type: "string"},
        nodeName: {type: "string"},
        type: {type: "string", enum: [TaskType.CatchEvent, TaskType.HumanTask]},
        correlation: {type: "object"},
    },
    required: ["deploymentId", "processDef", "processInstance", "nodeId", "type"],
    additionalProperties: false,
}

export const closeTaskDataSchema = {
    type: "object",
    properties: {
        processInstance: {type: "string"},
        nodeId: {type: "string"},
    },
    required: ["processInstance", "nodeId"],
    additionalProperties: false,
}

export class TaskStreamBuilder {

    /**
     *
     * @returns {Stream}
     */
    static build(){
        const stream = new Stream(StreamIds.TASK);
        stream.eventsRegistry = {
            CREATE_TASK: EventTypes.CREATE_TASK,
            CLOSE_TASK: EventTypes.CLOSE_TASK,
        }
        stream.validators = {
            [stream.eventsRegistry.CREATE_TASK]: createTaskDataSchema,
            [stream.eventsRegistry.CLOSE_TASK]: closeTaskDataSchema,
        }

        EventStore.registerStream(stream.streamId, stream);
        return stream;
    }

}
