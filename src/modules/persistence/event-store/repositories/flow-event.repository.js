import {AndromedaLogger} from "../../../../config/andromeda-logger.js";
import FlowEventModel, {FlowEventStatus} from "../internal/models/flow-event.orm-model.js";
import {RepositoryFactory} from "./repository.factory.js";
import {TABLE_DEFINITIONS} from "../internal/sqlite/table-definitions.js";
import {v4} from "uuid";
const Logger = new AndromedaLogger();

export class FlowEventRepository {

    /**
     * @type {BaseRepository}
     */
    repo;

    constructor() {
        this.repo = RepositoryFactory.create(FlowEventModel, TABLE_DEFINITIONS.FlowEvent);
    }

    /**
     *
     * @param {string}  processInstanceId
     * @param {string}  flowId
     * @param {number}  status
     * @returns {Promise<void>}
     */
    async createFlowEvent(processInstanceId,flowId ,status) {
        Logger.info(`create new flow id for process instance ${processInstanceId}`);
        // @type {ProcessInstance}
        let processInstance= {
            _id: v4(),
            flowId: flowId,
            processInstance: processInstanceId,
            status: status,
        }
        await this.repo.create(processInstance)
    }


    /**
     *
     * @param {string}  processInstanceId
     * @param {string}  flowId
     * @returns {Promise<void>}
     */
    async closeFlowEvent(processInstanceId,flowId) {
        Logger.info(`Close flow event id ${flowId} for process instance ${processInstanceId}`);
        let processInstance= {
            processInstance: processInstanceId,
            flowId: flowId,
        }
        await this.repo.update(processInstance, { status: FlowEventStatus.Completed})
    }

    /**
     * Looks up a still-pending (Active) flow event for a specific process
     * instance and flow — used to check whether an instance is genuinely
     * waiting at a given two-phase node before resuming it.
     * @param {string}  processInstanceId
     * @param {string}  flowId
     * @returns {Promise<object|null>}
     */
    async findActiveFlowEvent(processInstanceId, flowId) {
        return this.repo.findOne({
            processInstance: processInstanceId,
            flowId: flowId,
            status: FlowEventStatus.Active,
        });
    }

    /**
     * Every still-pending (Active) flow event across every process instance
     * in this container.
     * @returns {Promise<object[]>}
     */
    async findAllActiveFlowEvents() {
        return this.repo.find({status: FlowEventStatus.Active});
    }

    /**
     * Atomically closes a flow event only if it's still Active, in one
     * conditional operation - the real claim primitive behind resuming a
     * two-phase node exactly once. Both POST /signal and a timer catch
     * event's TimerCatchResumeJob (timer-catch-resume.job.js.njk) can race to
     * resume the same node (a manual signal arriving at the same moment a
     * timer's job runs, or two container replicas' jobs both picking up the
     * same due timer); passing `status:
     * Active` inside the update's own filter - rather than a separate
     * check-then-close - means at most one caller's findOneAndUpdate can ever
     * match the still-Active document, so only one of them gets a non-null
     * result back.
     * @param {string} processInstanceId
     * @param {string} flowId
     * @returns {Promise<object|null>} the closed document if this call won
     *   the race, null if another caller already closed it (or it was never
     *   Active to begin with)
     */
    async closeFlowEventIfActive(processInstanceId, flowId) {
        Logger.info(`Attempting atomic close of flow event id ${flowId} for process instance ${processInstanceId}`);
        return this.repo.update(
            {processInstance: processInstanceId, flowId: flowId, status: FlowEventStatus.Active},
            {status: FlowEventStatus.Completed},
        );
    }

    /**
     *
     * @param {string}  processInstanceId
     * @param {string}  flowId
     * @returns {Promise<void>}
     */
    async abortFlowEvent(processInstanceId,flowId) {
        Logger.info(`Abort flow event id ${flowId} for process instance ${processInstanceId}`);
        let processInstance= {
            processInstance: processInstanceId,
            flowId: flowId,
        }
        await this.repo.update(processInstance, { status: FlowEventStatus.Aborted})
    }


    /**
     *
     * @param {string}  processInstanceId
     * @param {string}  flowId
     * @returns {Promise<void>}
     */
    async failFlowEvent(processInstanceId,flowId) {
        Logger.info(`Fail flow event id ${flowId} for process instance ${processInstanceId}`);
        let processInstance= {
            processInstance: processInstanceId,
            flowId: flowId,
        }
        await this.repo.update(processInstance, { status: FlowEventStatus.Error})
    }



}