import { AndromedaLogger } from "../../../../config/andromeda-logger.js";
import {VariableRepository} from "../repositories/variable.repository.js";
import {EventTypes} from "../event-types.js";

const Logger = new AndromedaLogger();

export class VariableProjection {

    /**
     *
     * @type {VariableRepository}
     */
    repo = new VariableRepository();

    async process(event) {
        if (event.type === EventTypes.BULK_UPSERT_VARIABLES) {
            Logger.trace(`bulk upserting ${event.data.variables.length} variable(s) for process instance ${event.data.processInstance}`)
            await this.repo.bulkUpsertVariables(
                event.data.variables,
                event.data.processInstance,
                event.data.processDef,
                event.data.deploymentId
            )
        }
    }

    async captureState() {
        return {variables: await this.repo.repo.dumpAll()};
    }

    async restoreState(state) {
        await this.repo.repo.restoreAll(state ? state.variables : []);
    }

    async reset() {
        await this.repo.repo.restoreAll([]);
    }
}
