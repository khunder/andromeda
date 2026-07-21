import {Stream} from "../../lib/stream.js";
import {StreamIds} from "../stream-ids.js";
import {EventStore} from "../../lib/event-store.js";
import {EventTypes} from "../../event-types.js";

export const bulkUpsertVariablesDataSchema = {
    type: "object",
    properties: {
        processInstance: {type: "string"},
        processDef: {type: "string"},
        deploymentId: {type: "string"},
        variables: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: {type: "string"},
                    type: {type: "string"},
                    // value is intentionally untyped: it holds whatever JS value
                    // the declared BPMN type resolves to (string, number, object...)
                },
                required: ["name", "type"],
            }
        },
    },
    required: ["processInstance", "processDef", "deploymentId", "variables"],
    additionalProperties: false,
}

export class VariableStreamBuilder {

    /**
     *
     * @returns {Stream}
     */
    static build(){
        const stream = new Stream(StreamIds.VARIABLE);
        stream.eventsRegistry = {
            BULK_UPSERT_VARIABLES: EventTypes.BULK_UPSERT_VARIABLES,
        }
        stream.validators = {
            [stream.eventsRegistry.BULK_UPSERT_VARIABLES]: bulkUpsertVariablesDataSchema,
        }

        EventStore.registerStream(stream.streamId, stream);
        return stream;
    }

}
