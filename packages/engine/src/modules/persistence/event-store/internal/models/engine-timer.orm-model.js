import mongoose from "mongoose";

// Backs durable-timers.js's Store contract for both the Timer Start Event
// (recurring, ISO 8601 `iso`, or a self-rescheduling one-shot chain for a
// raw cron `timeCycle` - see timer.service.js's `cron-start` handler) and
// the Timer Intermediate Catch Event (one-shot, auto-generated _id per
// arrival). A plain, non-event-sourced collection - dispatch state, not
// domain state needing replay/audit, same reasoning as the TimerJob/
// TimerTick collections this one replaces.
//
// `lockedBy`/`lockedUntil` are the atomic lease durable-timers.js's
// claimDue()/settle()/fail() condition every update on - see
// EngineTimerRepository for how those single-document conditional updates
// (the same claim idiom FlowEventRepository.closeFlowEventIfActive() and the
// old TimerJobRepository.claimById() already used) stand in for
// durable-timers.js's own transactional `tx` ,this codebase has no
// multi-document transaction primitive on either driver (Mongoose here has
// no replica set/session; sql.js has no concurrent writers to protect
// against), so "the handler's writes and the timer's own update commit
// together" isn't a guarantee this store can make - only the lease claim
// itself is atomic.
const EngineTimerSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    payload: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    dueAt: {
        type: Date,
        default: null // null = parked, after exhausting maxAttempts
    },
    everyMs: {
        type: Number,
        default: null // null = one-shot
    },
    remaining: {
        type: Number,
        default: null // fires left; null = unlimited
    },
    attempts: {
        type: Number,
        required: true,
        default: 0
    },
    lockedBy: {
        type: String,
        default: null
    },
    lockedUntil: {
        type: Date,
        default: null
    },
    lastError: {
        type: String,
        default: null
    }
}, {timestamps: true, _id: false})

EngineTimerSchema.index({dueAt: 1});

const EngineTimerModel = mongoose.model('EngineTimer', EngineTimerSchema, 'EngineTimer')

export default EngineTimerModel;
