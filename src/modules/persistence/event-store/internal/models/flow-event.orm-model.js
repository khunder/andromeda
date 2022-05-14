
import mongoose from "mongoose";
import {v4} from "uuid";

export const FlowEventStatus = {
    Active: 0,
    Completed: 1,
    Error: 2,
    Aborted: 3
};

const FlowEventSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: v4()
    },

    flowId: {
        type: String,
        required: true
    },
    processInstance: {
        type: String,
        required: true
    },
    status: {
        type: Number,
        enum: [FlowEventStatus.Active, FlowEventStatus.Completed, FlowEventStatus.Error, FlowEventStatus.Aborted ],
        required: true,
        default: 0
    }

})

const FlowEventModel = mongoose.model('FlowEvent', FlowEventSchema , 'FlowEvent' )

export default FlowEventModel;