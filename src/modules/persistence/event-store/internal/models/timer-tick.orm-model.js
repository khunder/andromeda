
import mongoose from "mongoose";
import {v4} from "uuid";

// One document per (deploymentId, processDef, nodeId, tickKey) - the unique
// index is the actual HA mechanism: every container replica running the same
// deployment races to insert the same document for a given cron fire, and
// only one insert can succeed. See TimerTickRepository.claimTick().
const TimerTickSchema = new mongoose.Schema({
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
    nodeId: {
        type: String,
        required: true
    },
    // identifies which cron fire this claim is for - the fire time truncated
    // to the whole second (see timer.service.js), so every replica racing
    // the same tick agrees on the same key regardless of small clock/
    // scheduling jitter between them
    tickKey: {
        type: String,
        required: true
    }
}, {timestamps: true})

TimerTickSchema.index({deploymentId: 1, processDef: 1, nodeId: 1, tickKey: 1}, {unique: true});

const TimerTickModel = mongoose.model('TimerTick', TimerTickSchema, 'TimerTick')

export default TimerTickModel;
