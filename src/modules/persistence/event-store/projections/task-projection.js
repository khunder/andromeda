import { AndromedaLogger } from "../../../../config/andromeda-logger.js";
import {TaskRepository} from "../repositories/task.repository.js";
import {EventTypes} from "../event-types.js";

const Logger = new AndromedaLogger();

export class TaskProjection {

    /**
     *
     * @type {TaskRepository}
     */
    repo = new TaskRepository();

    async process(event) {
        if (event.type === EventTypes.CREATE_TASK) {
            Logger.trace(`Create TASK ${event.data.nodeId}, for PI= ${event.data.processInstance}`)
            await this.repo.createTask(
                event.data.deploymentId,
                event.data.processDef,
                event.data.processInstance,
                event.data.nodeId,
                event.data.nodeName,
                event.data.type,
                event.data.correlation,
            )
        }
        if (event.type === EventTypes.CLOSE_TASK) {
            Logger.trace(`Close TASK ${event.data.nodeId}, for PI= ${event.data.processInstance}`)
            await this.repo.closeTask(event.data.processInstance, event.data.nodeId)
        }
    }

    async captureState() {
        return {tasks: await this.repo.repo.dumpAll()};
    }

    async restoreState(state) {
        await this.repo.repo.restoreAll(state ? state.tasks : []);
    }

    async reset() {
        await this.repo.repo.restoreAll([]);
    }
}
