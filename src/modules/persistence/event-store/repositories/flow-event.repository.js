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


}