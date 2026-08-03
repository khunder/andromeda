import mongoose from "mongoose";

// One document per event-sourcing streamId (a small, fixed set - see
// StreamIds) holding the next position to hand out. Backs
// StreamCounterRepository.reserveNext()'s atomic $inc claim - what makes
// streamPosition assignment safe across multiple container replicas writing
// to the same stream concurrently (see EventStore.updateStreamPosition()).
// Previously streamPosition was an in-memory, per-process counter
// (Stream.streamPosition), which let two replicas both compute the same
// "next" position for the same stream and collide on the unique
// (streamId, streamPosition) index the instant they wrote concurrently.
const StreamCounterSchema = new mongoose.Schema({
    _id: {
        type: String,
    },
    seq: {
        type: Number,
        required: true,
        default: 0,
    }
}, {versionKey: false})

const StreamCounterModel = mongoose.model('StreamCounter', StreamCounterSchema, 'StreamCounter')

export default StreamCounterModel;
