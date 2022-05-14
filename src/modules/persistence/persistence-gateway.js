import {EventStore} from "./event-store/lib/event-store.js";
import {v4} from "uuid";
import {EventTypes} from "./event-store/event-types.js";
import {ProcessInstanceStreamBuilder} from "./event-store/streams/process-instance/process-instance.stream-builder.js";
import {ProcessInstanceProjection} from "./event-store/projections/process-instance-projection.js";
import {FlowEventStreamBuilder} from "./event-store/streams/fow-event/flow-event.stream-builder.js";
import {StreamIds} from "./event-store/streams/stream-ids.js";
import {FlowEventProjection} from "./event-store/projections/flow-event-projection.js";

export class PersistenceGateway {

    static async newProcessInstance({processInstanceId, deploymentId, processDef, containerId}) {
        await EventStore.apply(
            {
                id: v4(),
                streamId: StreamIds.PROCESS_INSTANCE,
                type: EventTypes.CREATE_PROCESS_INSTANCE,
                streamPosition: 0,
                data: {
                    id: processInstanceId,
                    deploymentId: deploymentId,
                    processDef: processDef,
                    status: 0,
                    containerId: containerId
                },
                timestamp: new Date().toString()
            }
        )
    }

    static async closeProcessInstance({processInstanceId}) {
        await EventStore.apply(
            {
                id: v4(),
                streamId: StreamIds.PROCESS_INSTANCE,
                type: EventTypes.CLOSE_PROCESS_INSTANCE,
                streamPosition: 0,
                data: {
                    id: processInstanceId
                },
                timestamp: new Date().toString()
            }
        )
    };

    static init() {
        PersistenceGateway.registerStreams()
    }

    static registerStreams(){
        const stream = ProcessInstanceStreamBuilder.build()
        this.registerProjections(stream, stream.eventsRegistry.CREATE_PROCESS_INSTANCE, new ProcessInstanceProjection());
        this.registerProjections(stream, stream.eventsRegistry.CLOSE_PROCESS_INSTANCE, new ProcessInstanceProjection());

        const flowEventStream = FlowEventStreamBuilder.build()
        this.registerProjections(flowEventStream, flowEventStream.eventsRegistry.CREATE_FLOW_EVENT, new FlowEventProjection());

    }

    /**
     *
     * @param {Stream} stream
     * @param {string} eventType
     * @param projector
     */
    static registerProjections(stream, eventType, projector){
        stream.projections[eventType] =projector;
    }
}