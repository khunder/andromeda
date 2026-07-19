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
     * waiting at a given intermediate catch event before resuming it.
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
     * in this container — used to list waiting human tasks (GET /tasks)
     * without knowing which instance/flow to look for ahead of time.
     * @returns {Promise<object[]>}
     */
    async findAllActiveFlowEvents() {
        return this.repo.find({status: FlowEventStatus.Active});
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