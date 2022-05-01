import BaseRepository from "./baseRepository.js";
import ProcessInstance from "../models/process.instance.js";

import {AndromedaLogger} from "../../../config/andromeda-logger.js";
const Logger = new AndromedaLogger();

export class ProcessInstanceRepository {

    /**
     * @type {BaseRepository}
     */
    repo;

    constructor() {
        this.repo= new BaseRepository(ProcessInstance)
    }

    /**
     *
     * @param {string} processInstanceId
     * @param {string} processDef
     * @param {string} deploymentId
     * @param {string} containerId
     * @returns {Promise<void>}
     */
    async createNewProcessInstance(processInstanceId,deploymentId, processDef, containerId) {
        Logger.info(`create new process instance ${processInstanceId}`);
        // @type {ProcessInstance}
        let processInstance= {
            _id: processInstanceId,
            processDef: processDef,
            deploymentId: deploymentId,
            status: 0,
            lock: {
                containerId: containerId,
                date: new Date()
            }
        }
        await this.repo.create(processInstance)
    }

    /**
     *
     * @param {string} processInstanceId
     * @returns {Promise<void>}
     */
    async removeLock(processInstanceId){
        await this.repo.upsert({_id: processInstanceId}, {lock: null})
    }

}