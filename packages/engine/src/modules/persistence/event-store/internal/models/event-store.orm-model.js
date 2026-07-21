
import mongoose from "mongoose";
import {v4} from "uuid";


const EventStoreSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => v4(),
    },
    streamId: {
        type: String,
        required: true
    },
    streamPosition: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    data: {
        type: Object,
        required: false
    },
    timestamp: {
        type: Date,
        required: true
    },
    metadata: {
        type: Object,
        required: false
    }

})

// Enforces one event per position per stream at the database level: if two writers
// (e.g. two engine instances in HA mode) ever race to compute the same next
// position for the same streamId, the second insert fails loudly instead of
// silently overwriting/duplicating history.
EventStoreSchema.index({ streamId: 1, streamPosition: 1 }, { unique: true });

const EventStoreModel = mongoose.model('EventStore', EventStoreSchema , 'EventStore' )

export default EventStoreModel;