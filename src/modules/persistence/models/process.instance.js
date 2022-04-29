
import mongoose from "mongoose";
import {v4} from "uuid";


const ProcessInstanceStatus = {
    Active: 0,
    Completed: 1,
    Error: 2,
    Aborted: 3
};


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
})

const ProcessInstance = mongoose.model('ProcessInstance', processInstanceSchema ,{ collection: 'ProcessInstance' })

export default ProcessInstance;