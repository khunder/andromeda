import AndromedaLogger from "../../../../config/andromeda-logger.js";
import {ProcessInstanceRepository} from "../repositories/process-instance.repository.js";
import {EventTypes} from "../event-types.js";
import {FlowEventRepository} from "../repositories/flow-event.repository.js";

const Logger = new AndromedaLogger();
export class FlowEventProjection {

    /**
     *
     * @type {FlowEventRepository}
     */
    repo = new FlowEventRepository();



    async process(event) {
        if (event.type === EventTypes.CREATE_FLOW_EVENT) {
            Logger.trace("CREATING FLOW EVENT instance")
            await this.repo.createFlowEvent(event.data.processInstance, event.data.flowId, event.data.status)
        }
    }
}