import AndromedaLogger from "../../../../config/andromeda-logger.js";
import {ProcessInstanceRepository} from "../repositories/process-instance.repository.js";
import {EventTypes} from "../event-types.js";

const Logger = new AndromedaLogger();
export class ProcessInstanceProjection {

    /**
     *
     * @type {ProcessInstanceRepository}
     */
    repo = new ProcessInstanceRepository();



    async process(event) {
        if (event.type === EventTypes.CLOSE_PROCESS_INSTANCE) {
            Logger.trace("Complete process instance")
            await this.repo.completeProcessInstance(event.data.id);
        }
        if (event.type === EventTypes.CREATE_PROCESS_INSTANCE) {
            Logger.trace("creating new process instance")

            await this.repo.createNewProcessInstance(event.data.id, event.data.deploymentId, event.data.processDef, event.data.containerId);
        }

    }
}