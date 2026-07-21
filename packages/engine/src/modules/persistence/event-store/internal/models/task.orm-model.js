
import mongoose from "mongoose";
import {v4} from "uuid";

export const TaskType = {
    CatchEvent: 'CatchEvent',
    HumanTask: 'HumanTask',
};

export const TaskStatus = {
    Active: 0,
    Completed: 1,
};

const TaskSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => v4()
    },
    deploymentId: {
        type: String,
        required: true
    },
    processDef: {
        type: String,
        required: true
    },
    processInstance: {
        type: String,
        required: true
    },
    nodeId: {
        type: String,
        required: true
    },
    nodeName: {
        type: String,
        required: false
    },
    type: {
        type: String,
        enum: [TaskType.CatchEvent, TaskType.HumanTask],
        required: true
    },
    status: {
        type: Number,
        enum: [TaskStatus.Active, TaskStatus.Completed],
        required: true,
        default: TaskStatus.Active
    },
    // arbitrary matching data (e.g. a catch event's signal name) a future
    // broadcast-style /signal could use to find the right waiting task(s)
    // without the caller already knowing processInstance/nodeId - not
    // queried against yet, just carried alongside the task record
    correlation: {
        type: Object,
        required: false
    }
}, {timestamps: true})

const TaskModel = mongoose.model('Task', TaskSchema, 'Task')

export default TaskModel;
