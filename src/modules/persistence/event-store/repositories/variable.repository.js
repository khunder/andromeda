import BaseRepository from "./baseRepository.js";

import {AndromedaLogger} from "../../../../config/andromeda-logger.js";
import {Config} from "../../../../config/config.js";
import VariableModel from "../internal/models/variable.orm-model.js";
import FakeRepositoryBase from "../internal/fake.repository.base.js";
import {v4} from "uuid";

const Logger = new AndromedaLogger();

export class VariableRepository {

    /**
     * @type {BaseRepository}
     */
    repo;

    constructor() {
        if(Config.getInstance().isUnitTestMode){
            this.repo = new FakeRepositoryBase(VariableModel)
        }else {
            this.repo = new BaseRepository(VariableModel)
        }
    }

    isPrimitive(value) {
        return value !== Object(value);
    }

    /**
     * One document per variable per process instance, keyed on (processInstance, name).
     * @param {Array<{name: string, type: string, value: any}>} variables
     * @param {string} processInstanceId
     * @param {string} processDef
     * @param {string} deploymentId
     * @returns {Promise<void>}
     */
    async bulkUpsertVariables(variables, processInstanceId, processDef, deploymentId) {
        Logger.info(`bulk upserting ${variables.length} variable(s) for process instance ${processInstanceId}`);

        const operations = variables.map((variable) => {
            const update = {
                $set: {
                    name: variable.name,
                    type: variable.type,
                    processDef: processDef,
                    deploymentId: deploymentId,
                    processInstance: processInstanceId,
                    value: this.isPrimitive(variable.value) ? String(variable.value) : JSON.stringify(variable.value)
                },
                $setOnInsert: {_id: v4()}
            };

            return {
                updateOne: {
                    filter: {processInstance: processInstanceId, name: variable.name},
                    update,
                    upsert: true
                }
            };
        });

        await this.repo.bulkWrite(operations);
    }

    /**
     * @param {string} processInstanceId
     * @returns {Promise<object[]>}
     */
    async getVariables(processInstanceId) {
        return this.repo.find({processInstance: processInstanceId});
    }

}

export default VariableRepository;
