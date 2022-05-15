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
            Logger.trace(`Create FLOW EVENT ${event.data.flowId}, for PI= ${event.data.processInstance}`)
            await this.repo.createFlowEvent(event.data.processInstance, event.data.flowId, event.data.status)
        }
        if (event.type === EventTypes.CLOSE_FLOW_EVENT) {
            Logger.trace(`Close FLOW EVENT ${event.data.flowId}, for PI= ${event.data.processInstance}`)
            await this.repo.closeFlowEvent(event.data.processInstance, event.data.flowId)
        }
        if (event.type === EventTypes.ABORT_FLOW_EVENT) {
            Logger.trace(`Abort FLOW EVENT ${event.data.flowId}, for PI= ${event.data.processInstance}`)
            await this.repo.abortFlowEvent(event.data.processInstance, event.data.flowId)
        }

        if (event.type === EventTypes.FAIL_FLOW_EVENT) {
            Logger.trace(`Fail FLOW EVENT ${event.data.flowId}, for PI= ${event.data.processInstance}`)
            await this.repo.failFlowEvent(event.data.processInstance, event.data.flowId)
        }
    }
}