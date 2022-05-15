import BaseRepository from "./baseRepository.js";

import {AndromedaLogger} from "../../../../config/andromeda-logger.js";
import FlowEventModel, {FlowEventStatus} from "../internal/models/flow-event.orm-model.js";
import {v4} from "uuid";
const Logger = new AndromedaLogger();

export class FlowEventRepository {

    /**
     * @type {BaseRepository}
     */
    repo;

    constructor() {
        this.repo= new BaseRepository(FlowEventModel)
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
        await this.repo.upsert(processInstance, { status: FlowEventStatus.Completed})
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
        await this.repo.upsert(processInstance, { status: FlowEventStatus.Aborted})
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
        await this.repo.upsert(processInstance, { status: FlowEventStatus.Error})
    }



}