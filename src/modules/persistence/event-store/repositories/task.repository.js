import {AndromedaLogger} from "../../../../config/andromeda-logger.js";
import TaskModel, {TaskStatus} from "../internal/models/task.orm-model.js";
import {RepositoryFactory} from "./repository.factory.js";
import {TABLE_DEFINITIONS} from "../internal/sqlite/table-definitions.js";
import {v4} from "uuid";

const Logger = new AndromedaLogger();

export class TaskRepository {

    /**
     * @type {BaseRepository}
     */
    repo;

    constructor() {
        this.repo = RepositoryFactory.create(TaskModel, TABLE_DEFINITIONS.Task);
    }

    /**
     * @param {string} deploymentId
     * @param {string} processDef
     * @param {string} processInstanceId
     * @param {string} nodeId
     * @param {string} nodeName
     * @param {string} type - TaskType.CatchEvent | TaskType.HumanTask
     * @param {object} correlation
     * @returns {Promise<void>}
     */
    async createTask(deploymentId, processDef, processInstanceId, nodeId, nodeName, type, correlation) {
        Logger.info(`create new task ${nodeId} for process instance ${processInstanceId}`);
        let task = {
            _id: v4(),
            deploymentId: deploymentId,
            processDef: processDef,
            processInstance: processInstanceId,
            nodeId: nodeId,
            nodeName: nodeName,
            type: type,
            status: TaskStatus.Active,
            correlation: correlation || {},
        }
        await this.repo.create(task)
    }

    /**
     * @param {string} processInstanceId
     * @param {string} nodeId
     * @returns {Promise<void>}
     */
    async closeTask(processInstanceId, nodeId) {
        Logger.info(`Close task ${nodeId} for process instance ${processInstanceId}`);
        await this.repo.update(
            {processInstance: processInstanceId, nodeId: nodeId},
            {status: TaskStatus.Completed}
        )
    }

    /**
     * @param {string} processInstanceId
     * @param {string} nodeId
     * @returns {Promise<object|null>}
     */
    async findActiveTask(processInstanceId, nodeId) {
        return this.repo.findOne({
            processInstance: processInstanceId,
            nodeId: nodeId,
            status: TaskStatus.Active,
        });
    }

    /**
     * Every still-pending task across every process instance — optionally
     * narrowed to one type (e.g. only HumanTask, for GET /tasks).
     * @param {string} [type]
     * @returns {Promise<object[]>}
     */
    async findAllActiveTasks(type) {
        const cond = {status: TaskStatus.Active};
        if (type) {
            cond.type = type;
        }
        return this.repo.find(cond);
    }

}

export default TaskRepository;
