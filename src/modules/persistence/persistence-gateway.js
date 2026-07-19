import {EventStore} from "./event-store/lib/event-store.js";
import {v4} from "uuid";
import {EventTypes} from "./event-store/event-types.js";
import {ProcessInstanceStreamBuilder} from "./event-store/streams/process-instance/process-instance.stream-builder.js";
import {ProcessInstanceProjection} from "./event-store/projections/process-instance-projection.js";
import {FlowEventStreamBuilder} from "./event-store/streams/fow-event/flow-event.stream-builder.js";
import {StreamIds} from "./event-store/streams/stream-ids.js";
import {FlowEventProjection} from "./event-store/projections/flow-event-projection.js";
import {VariableStreamBuilder} from "./event-store/streams/variable/variable.stream-builder.js";
import {VariableProjection} from "./event-store/projections/variable-projection.js";
import {ReplayService} from "./event-store/lib/replay.service.js";
import {FlowEventRepository} from "./event-store/repositories/flow-event.repository.js";
import {ProcessInstanceRepository} from "./event-store/repositories/process-instance.repository.js";
import {VariableRepository} from "./event-store/repositories/variable.repository.js";

export class PersistenceGateway {

    static async newProcessInstance({processInstanceId, deploymentId, processDef, containerId}) {
        await EventStore.apply(
            {
                id: v4(),
                streamId: StreamIds.PROCESS_INSTANCE,
                type: EventTypes.CREATE_PROCESS_INSTANCE,
                data: {
                    id: processInstanceId,
                    deploymentId: deploymentId,
                    processDef: processDef,
                    status: 0,
                    containerId: containerId
                },
                timestamp: new Date().toISOString()
            }
        )
    }

    static async closeProcessInstance({processInstanceId}) {
        await EventStore.apply(
            {
                id: v4(),
                streamId: StreamIds.PROCESS_INSTANCE,
                type: EventTypes.CLOSE_PROCESS_INSTANCE,
                data: {
                    id: processInstanceId
                },
                timestamp: new Date().toISOString()
            }
        )
    };


    static async createFlowEvent({processInstanceId, flowId, status}) {
        await EventStore.apply(
            {
                id: v4(),
                streamId: StreamIds.FLOW_EVENT,
                type: EventTypes.CREATE_FLOW_EVENT,
                data: {
                    processInstance: processInstanceId,
                    flowId: flowId,
                    status: status
                },
                timestamp: new Date().toISOString()
            }
        )
    };

    static async closeFlowEvent({processInstanceId, flowId}) {
        await EventStore.apply(
            {
                id: v4(),
                streamId: StreamIds.FLOW_EVENT,
                type: EventTypes.CLOSE_FLOW_EVENT,
                data: {
                    processInstance: processInstanceId,
                    flowId: flowId,
                },
                timestamp: new Date().toISOString()
            }
        )
    };

    static async failFlowEvent({processInstanceId, flowId}) {
        await EventStore.apply(
            {
                id: v4(),
                streamId: StreamIds.FLOW_EVENT,
                type: EventTypes.FAIL_FLOW_EVENT,
                data: {
                    processInstance: processInstanceId,
                    flowId: flowId,
                },
                timestamp: new Date().toISOString()
            }
        )
    };

    static async abortFlowEvent({processInstanceId, flowId}) {
        await EventStore.apply(
            {
                id: v4(),
                streamId: StreamIds.FLOW_EVENT,
                type: EventTypes.ABORT_FLOW_EVENT,
                data: {
                    processInstance: processInstanceId,
                    flowId: flowId,
                },
                timestamp: new Date().toISOString()
            }
        )
    };

    /**
     * Persist only the variables that actually changed (dirty-checked by the caller).
     * @param {string} processInstanceId
     * @param {string} processDef
     * @param {string} deploymentId
     * @param {Array<{name: string, type: string, value: any}>} variables
     */
    static async saveVariables({processInstanceId, processDef, deploymentId, variables}) {
        if (!variables || variables.length === 0) {
            return;
        }
        await EventStore.apply(
            {
                id: v4(),
                streamId: StreamIds.VARIABLE,
                type: EventTypes.BULK_UPSERT_VARIABLES,
                data: {
                    processInstance: processInstanceId,
                    processDef: processDef,
                    deploymentId: deploymentId,
                    variables: variables,
                },
                timestamp: new Date().toISOString()
            }
        )
    };

    /**
     * Checks whether a process instance is genuinely still waiting at a
     * specific flow (i.e. an intermediate catch event's incoming flow whose
     * event is Active/unclosed) — read-only, bypasses the event-sourced write
     * path since there's nothing to append to the log here.
     * @param {string} processInstanceId
     * @param {string} flowId
     * @returns {Promise<object|null>}
     */
    static async findActiveFlowEvent({processInstanceId, flowId}) {
        return new FlowEventRepository().findActiveFlowEvent(processInstanceId, flowId);
    }

    /**
     * Read-only lookup used to restore a process instance that's paused at a
     * catch event but no longer live in the container's memory (e.g. after a
     * restart) — see {ProcessDef}ProcessInstanceService.restoreInstance().
     * @param {string} processInstanceId
     * @returns {Promise<object|null>}
     */
    static async getProcessInstance({processInstanceId}) {
        return new ProcessInstanceRepository().getProcessInstance(processInstanceId);
    }

    /**
     * All persisted variables for a process instance, used to rehydrate a
     * restored instance's variable values.
     * @param {string} processInstanceId
     * @returns {Promise<object[]>}
     */
    static async getVariables({processInstanceId}) {
        return new VariableRepository().getVariables(processInstanceId);
    }

    static async init() {
        PersistenceGateway.registerStreams()
        // continue stream numbering from the persisted log after a restart
        await ReplayService.seedStreamPositions()
    }

    // persist a read-model snapshot every N events, bounding replay time
    static SNAPSHOT_FREQUENCY = 100;

    static registerStreams(){
        const stream = ProcessInstanceStreamBuilder.build()
        const processInstanceProjection = new ProcessInstanceProjection();
        this.registerProjections(stream, stream.eventsRegistry.CREATE_PROCESS_INSTANCE, processInstanceProjection);
        this.registerProjections(stream, stream.eventsRegistry.CLOSE_PROCESS_INSTANCE, processInstanceProjection);
        stream.snapshotHandler = processInstanceProjection;
        stream.snapshotFrequency = PersistenceGateway.SNAPSHOT_FREQUENCY;

        const flowEventStream = FlowEventStreamBuilder.build()
        const flowEventProjection = new FlowEventProjection();
        this.registerProjections(flowEventStream, flowEventStream.eventsRegistry.CREATE_FLOW_EVENT, flowEventProjection);
        this.registerProjections(flowEventStream, flowEventStream.eventsRegistry.CLOSE_FLOW_EVENT, flowEventProjection);
        this.registerProjections(flowEventStream, flowEventStream.eventsRegistry.ABORT_FLOW_EVENT, flowEventProjection);
        this.registerProjections(flowEventStream, flowEventStream.eventsRegistry.FAIL_FLOW_EVENT, flowEventProjection);
        flowEventStream.snapshotHandler = flowEventProjection;
        flowEventStream.snapshotFrequency = PersistenceGateway.SNAPSHOT_FREQUENCY;

        const variableStream = VariableStreamBuilder.build()
        const variableProjection = new VariableProjection();
        this.registerProjections(variableStream, variableStream.eventsRegistry.BULK_UPSERT_VARIABLES, variableProjection);
        variableStream.snapshotHandler = variableProjection;
        variableStream.snapshotFrequency = PersistenceGateway.SNAPSHOT_FREQUENCY;

    }

    /**
     * Rebuild a stream's read model from its latest snapshot plus the event log.
     * @param {string} streamId
     * @returns {Promise<number>} number of events replayed
     */
    static async replayStream(streamId) {
        return ReplayService.replayStream(streamId)
    }

    /**
     * Rebuild every read model from snapshots plus the event log.
     * @returns {Promise<object>} replayed event count per streamId
     */
    static async replayAll() {
        return ReplayService.replayAll()
    }

    /**
     * Force a snapshot of a stream's current read-model state.
     * @param {string} streamId
     * @returns {Promise<void>}
     */
    static async snapshotStream(streamId) {
        return ReplayService.snapshotStream(streamId)
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