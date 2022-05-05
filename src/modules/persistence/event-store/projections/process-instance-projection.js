import AndromedaLogger from "../../../../config/andromeda-logger.js";
import {ProcessInstanceRepository} from "../repositories/process-instance.repository.js";

const Logger = new AndromedaLogger();
export class ProcessInstanceProjection {

    /**
     *
     * @type {ProcessInstanceRepository}
     */
    repo = new ProcessInstanceRepository();



    async process(event) {
        if (event.type === "CLOSE_PROCESS_INSTANCE") {
            Logger.trace("Complete process instance")
            await this.repo.completeProcessInstance(event.data.id);
        }
        if (event.type === "CREATE_PROCESS_INSTANCE") {
            Logger.trace("creating new process instance")

            await this.repo.createNewProcessInstance(event.data.id, event.data.deploymentId, event.data.processDef, event.data.containerId);
        }

        // console.dir(event)
    }
}