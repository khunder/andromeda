import {AndromedaLogger} from "../../../../config/andromeda-logger.js";
import ProcessInstanceModel, {ProcessInstanceStatus} from "../internal/models/process-instance.orm-model.js";
import {RepositoryFactory} from "./repository.factory.js";
import {TABLE_DEFINITIONS} from "../internal/sqlite/table-definitions.js";
const Logger = new AndromedaLogger();

export class ProcessInstanceRepository {

    /**
     * @type {BaseRepository}
     */
    repo;

    constructor() {
        this.repo = RepositoryFactory.create(ProcessInstanceModel, TABLE_DEFINITIONS.ProcessInstance);
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
            status: ProcessInstanceStatus.Active,
            lock: {
                containerId: containerId,
                date: new Date()
            }
        }
        await this.repo.create(processInstance)
    }

    /**
     * @param {string} processInstanceId
     * @returns {Promise<object|null>}
     */
    async getProcessInstance(processInstanceId) {
        return this.repo.findById(processInstanceId);
    }

    /**
     *
     * @param {string} processInstanceId
     * @returns {Promise<void>}
     */
    async removeLock(processInstanceId){
        Logger.trace(`updating process instance ${processInstanceId}, set lock to null`);
        await this.repo.update({_id: processInstanceId}, {lock: null})
    }

    async completeProcessInstance(processInstanceId){
        Logger.debug(`updating process instance ${processInstanceId}, set lock to null and status = ${ ProcessInstanceStatus.Completed}`);
        await this.repo.update({_id: processInstanceId}, {status: ProcessInstanceStatus.Completed, lock: null})
    }

}