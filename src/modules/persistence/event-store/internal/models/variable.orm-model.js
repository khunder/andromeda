
import mongoose from "mongoose";
import {v4} from "uuid";

const VariableSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => v4(),
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    // stored as a string regardless of declared type, to ease debugging/ops
    // (see src/modules/readme.md) — the declared `type` is what re-hydrates it
    value: {
        type: String,
        required: false
    },
    processDef: {
        type: String,
        required: true
    },
    deploymentId: {
        type: String,
        required: true
    },
    processInstance: {
        type: String,
        required: true
    }
}, {timestamps: true})

// one document per variable name per process instance
VariableSchema.index({ processInstance: 1, name: 1 }, { unique: true });

const VariableModel = mongoose.model('Variable', VariableSchema , 'Variable' )

export default VariableModel;
