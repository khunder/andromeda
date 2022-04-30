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
     * @param {string} id
     * @param {string} processDef
     * @param {string} deploymentId
     * @returns {Promise<void>}
     */
    async createNewProcessInstance(id,deploymentId, processDef) {
        Logger.info(`create new process instance ${id}`);
        let processInstance= {
            _id: id,
            processDef: processDef,
            deploymentId: deploymentId,
            status: 0
        }
        await this.repo.create(processInstance)
    }
}