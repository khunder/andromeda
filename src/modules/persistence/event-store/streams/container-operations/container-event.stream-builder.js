import {StreamIds} from "../stream-ids.js";
import {EventStore} from "../../event-store.js";


export const processInstanceDataSchema = {
    type: "object",
    properties: {
        deploymentId: {type: "string"},
        variables: {type: "object"},
    },
    required: [ "deploymentId"],
    additionalProperties: false,
}



export class ContainerEventStreamBuilder {

    /**
     *
     * @returns {Stream}
     */
    build(){
        const stream = new Stream(StreamIds.CONTAINER_EVENTS);
        stream.eventsRegistry =  {
            START_PROCESS_INSTANCE: "START_PROCESS_INSTANCE",
        }
        stream.validators ={
            [stream.eventsRegistry.CREATE_PROCESS_INSTANCE] : processInstanceDataSchema,
        }

        EventStore.registerStream(stream.streamId, stream);
        return stream;
    }

}