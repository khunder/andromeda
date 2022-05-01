
import mongoose from "mongoose";
import {v4} from "uuid";

const ProcessInstanceStatus = {
    Active: 0,
    Completed: 1,
    Error: 2,
    Aborted: 3
};

const Lock = new mongoose.Schema({
    containerId      : String,
    date      : Date
});
const processInstanceSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: v4()
    },

    deploymentId: {
        type: String,
        required: true
    },
    processDef: {
        type: String,
        required: true
    },
    status: {
        type: Number,
        enum: [ProcessInstanceStatus.Active, ProcessInstanceStatus.Completed, ProcessInstanceStatus.Error, ProcessInstanceStatus.Aborted ],
        required: true,
        default: 0
    },
    lock: {
        type: Lock
    }
})

const ProcessInstance = mongoose.model('ProcessInstance', processInstanceSchema , 'ProcessInstance' )

export default ProcessInstance;