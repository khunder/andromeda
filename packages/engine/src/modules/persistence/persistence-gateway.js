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
import {TaskStreamBuilder} from "./event-store/streams/task/task.stream-builder.js";
import {TaskProjection} from "./event-store/projections/task-projection.js";
import {TaskRepository} from "./event-store/repositories/task.repository.js";
import {TimerTickRepository} from "./event-store/repositories/timer-tick.repository.js";
import {TimerJobRepository} from "./event-store/repositories/timer-job.repository.js";
import {ContainerRegistrationRepository} from "./event-store/repositories/container-registration.repository.js";

export class PersistenceGateway {

    // sentinel TimerJob.processDef identifying a recurring "system" sweep
    // occurrence (rescan-waiting-jobs / release-stale-jobs) rather than an
    // ordinary catch-resume job - see enqueueSystemTimerJob() and
    // TimerService.claimAndRun()/runSystemJob() in timer.service.js.njk.
    static SYSTEM_TIMER_JOB_PROCESS_DEF = TimerJobRepository.SYSTEM_JOB_PROCESS_DEF;

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
     * Records a two-phase node (intermediate catch event or human task) as
     * paused/waiting. This is a read-side record for external consumers
     * (Galaxy, other APIs) that want to list/inspect pending tasks without
     * reaching into FlowEvent directly — it does NOT gate resume behavior;
     * the container's own POST /signal still checks/closes the FlowEvent
     * (status 0/Active on the node's incoming flow, set by
     * isTwoPhaseComponent()/createFlowEvent() in service.njk) as before.
     * @param {string} deploymentId
     * @param {string} processDef
     * @param {string} processInstanceId
     * @param {string} nodeId
     * @param {string} nodeName
     * @param {string} type - TaskType.CatchEvent | TaskType.HumanTask
     * @param {object} [correlation]
     */
    static async createTask({deploymentId, processDef, processInstanceId, nodeId, nodeName, type, correlation}) {
        await EventStore.apply(
            {
                id: v4(),
                streamId: StreamIds.TASK,
                type: EventTypes.CREATE_TASK,
                data: {
                    deploymentId: deploymentId,
                    processDef: processDef,
                    processInstance: processInstanceId,
                    nodeId: nodeId,
                    nodeName: nodeName,
                    type: type,
                    correlation: correlation || {},
                },
                timestamp: new Date().toISOString()
            }
        )
    };

    /**
     * Marks a two-phase node's task Completed once it's been resumed.
     * @param {string} processInstanceId
     * @param {string} nodeId
     */
    static async closeTask({processInstanceId, nodeId}) {
        await EventStore.apply(
            {
                id: v4(),
                streamId: StreamIds.TASK,
                type: EventTypes.CLOSE_TASK,
                data: {
                    processInstance: processInstanceId,
                    nodeId: nodeId,
                },
                timestamp: new Date().toISOString()
            }
        )
    };

    /**
     * Checks whether a process instance is genuinely still waiting at a
     * specific two-phase node — read-only, bypasses the event-sourced write
     * path since there's nothing to append to the log here.
     * @param {string} processInstanceId
     * @param {string} nodeId
     * @returns {Promise<object|null>}
     */
    static async findActiveTask({processInstanceId, nodeId}) {
        return new TaskRepository().findActiveTask(processInstanceId, nodeId);
    }

    /**
     * Every still-pending task across every process instance in this
     * container, optionally narrowed to one type and/or one processDef —
     * backs GET /tasks.
     * @param {string} [type]
     * @param {string} [processDef]
     * @returns {Promise<object[]>}
     */
    static async findAllActiveTasks(type, processDef) {
        return new TaskRepository().findAllActiveTasks(type, processDef);
    }

    /**
     * Checks whether a process instance is genuinely still waiting at a
     * specific flow (i.e. a two-phase node's incoming flow whose event is
     * Active/unclosed) — the container's own authoritative gate for POST
     * /signal, restored alongside the Task-based external record above.
     * @param {string} processInstanceId
     * @param {string} flowId
     * @returns {Promise<object|null>}
     */
    static async findActiveFlowEvent({processInstanceId, flowId}) {
        return new FlowEventRepository().findActiveFlowEvent(processInstanceId, flowId);
    }

    /**
     * Every still-pending flow event across every process instance in this
     * container.
     * @returns {Promise<object[]>}
     */
    static async findAllActiveFlowEvents() {
        return new FlowEventRepository().findAllActiveFlowEvents();
    }

    /**
     * Atomically closes a flow event only if it's still Active - the claim
     * primitive used to resume a two-phase node exactly once even when two
     * things could plausibly race to resume it at once (POST /signal and a
     * timer catch event's resume job, or two container replicas' jobs both
     * catching the same due timer). See FlowEventRepository.closeFlowEventIfActive().
     * @param {string} processInstanceId
     * @param {string} flowId
     * @returns {Promise<object|null>} the closed flow event if this call won
     *   the race, null otherwise
     */
    static async closeFlowEventIfActive({processInstanceId, flowId}) {
        return new FlowEventRepository().closeFlowEventIfActive(processInstanceId, flowId);
    }

    /**
     * Claims a single cron tick for a Timer Start Event node, for the HA
     * dedupe mechanism described in TimerTickRepository: every container
     * replica running this deployment races to claim the same
     * (deploymentId, processDef, nodeId, tickKey), and the backing unique
     * index guarantees only one of them gets `true` back.
     * @param {string} deploymentId
     * @param {string} processDef
     * @param {string} nodeId
     * @param {string} tickKey
     * @returns {Promise<boolean>}
     */
    static async claimTimerTick({deploymentId, processDef, nodeId, tickKey}) {
        return new TimerTickRepository().claimTick(deploymentId, processDef, nodeId, tickKey);
    }

    /**
     * Schedules a timer catch event's resume for a specific due time - see
     * TimerJobRepository. Called once, the moment a process instance first
     * arrives at a timer intermediate catch event (catch-event.processor.js's
     * codegen), not from a periodic sweep.
     * @param {string} processInstanceId
     * @param {string} nodeId
     * @param {string} processDef
     * @param {Date} availableAt
     * @returns {Promise<object>}
     */
    static async enqueueTimerJob({processInstanceId, nodeId, processDef, availableAt}) {
        return new TimerJobRepository().enqueue({processInstanceId, nodeId, processDef, availableAt});
    }

    /**
     * Every currently 'waiting' timer resume job - backs TimerService's
     * low-frequency backstop sweep, not the primary per-job schedule (see
     * TimerJobRepository.findWaiting()).
     * @returns {Promise<object[]>}
     */
    static async findWaitingTimerJobs() {
        return new TimerJobRepository().findWaiting();
    }

    /**
     * Atomically claims one specific due timer resume job for this
     * container replica to run - see TimerJobRepository.claimById() for the
     * exactly-once dispatch guarantee across replicas.
     * @param {string} id
     * @returns {Promise<object|null>}
     */
    static async claimTimerJob({id}) {
        return new TimerJobRepository().claimById(id);
    }

    /**
     * Marks a claimed timer resume job as finished.
     * @param {string} id
     * @returns {Promise<object|null>}
     */
    static async completeTimerJob({id}) {
        return new TimerJobRepository().complete(id);
    }

    /**
     * Requeues a claimed timer resume job that threw, or marks it
     * permanently failed once it has exhausted its attempts.
     * @param {string} id
     * @param {number} attempt
     * @param {number} maxAttempts
     * @param {Error|string} error
     * @returns {Promise<object|null>}
     */
    static async retryTimerJob({id, attempt, maxAttempts, error}) {
        return new TimerJobRepository().retryOrFail(id, attempt, maxAttempts, error);
    }

    /**
     * Releases timer resume jobs stuck 'claimed' for too long (a replica
     * that crashed mid-flight) back to 'waiting' so another replica can pick
     * them up.
     * @param {number} maxClaimedMs
     * @returns {Promise<number>}
     */
    static async releaseStaleTimerJobs({maxClaimedMs}) {
        return new TimerJobRepository().releaseStale(maxClaimedMs);
    }

    /**
     * Enqueues one occurrence of a recurring system sweep (rescan-waiting-
     * jobs / release-stale-jobs) into the same TimerJob queue ordinary
     * catch-resume jobs use, so it's claimed and run by exactly one replica
     * at a time instead of every replica ticking its own local cron - see
     * TimerService.ensureSystemJobScheduled()/runSystemJob().
     * @param {string} nodeId
     * @param {Date} availableAt
     * @returns {Promise<object>}
     */
    static async enqueueSystemTimerJob({nodeId, availableAt}) {
        return new TimerJobRepository().enqueueSystem({nodeId, availableAt});
    }

    /**
     * The currently pending occurrence of a given recurring system sweep,
     * if this deployment already has one - lets a newly-starting replica
     * rejoin an already-seeded chain instead of seeding a duplicate one.
     * @param {string} nodeId
     * @returns {Promise<object|null>}
     */
    static async findPendingSystemTimerJob({nodeId}) {
        return new TimerJobRepository().findPendingSystem(nodeId);
    }

    /**
     * Upserts this container replica's own row, keyed by
     * (deploymentId, version, containerId) - see ContainerRegistrationRepository
     * for why the unique key prevents concurrent replicas from racing on the
     * same document.
     * @param {string} deploymentId
     * @param {string} version
     * @param {string} containerId
     * @returns {Promise<object>}
     */
    static async registerContainerHeartbeat({deploymentId, version, containerId}) {
        return new ContainerRegistrationRepository().heartbeat(deploymentId, version, containerId);
    }

    /**
     * Every container registration row whose last heartbeat is still within
     * `maxAgeMs` - i.e. the currently "running" containers.
     * @param {string} [deploymentId]
     * @param {string} [version]
     * @param {number} maxAgeMs
     * @returns {Promise<object[]>}
     */
    static async findRunningContainers({deploymentId, version, maxAgeMs}) {
        return new ContainerRegistrationRepository().findRunning({deploymentId, version, maxAgeMs});
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

        const taskStream = TaskStreamBuilder.build()
        const taskProjection = new TaskProjection();
        this.registerProjections(taskStream, taskStream.eventsRegistry.CREATE_TASK, taskProjection);
        this.registerProjections(taskStream, taskStream.eventsRegistry.CLOSE_TASK, taskProjection);
        taskStream.snapshotHandler = taskProjection;
        taskStream.snapshotFrequency = PersistenceGateway.SNAPSHOT_FREQUENCY;

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