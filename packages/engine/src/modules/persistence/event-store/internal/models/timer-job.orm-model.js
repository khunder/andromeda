import mongoose from "mongoose";
import {v4} from "uuid";

// One document per pending/finished timer catch-event resume - the queue
// backing TimerService's catch-resume dispatcher (see
// TimerJobRepository.claimDue()). A plain, non-event-sourced collection: a
// scheduled resume isn't domain state needing replay/audit, it's operational
// dispatch state, same reasoning as TimerTick.
const TimerJobSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => v4()
    },
    processInstanceId: {
        type: String,
        required: true
    },
    nodeId: {
        type: String,
        required: true
    },
    processDef: {
        type: String,
        required: true
    },
    // 'waiting' | 'claimed' | 'completed' | 'failed'
    state: {
        type: String,
        required: true,
        default: 'waiting'
    },
    attempt: {
        type: Number,
        required: true,
        default: 0
    },
    maxAttempts: {
        type: Number,
        required: true,
        default: 5
    },
    // when this job becomes claimable - the node's computed due time
    availableAt: {
        type: Date,
        required: true
    },
    claimedAt: {
        type: Date,
        default: null
    },
    claimedBy: {
        type: String,
        default: null
    },
    lastError: {
        type: String,
        default: null
    }
}, {timestamps: true})

TimerJobSchema.index({state: 1, availableAt: 1});

const TimerJobModel = mongoose.model('TimerJob', TimerJobSchema, 'TimerJob')

export default TimerJobModel;
