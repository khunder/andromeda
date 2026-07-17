
import mongoose from "mongoose";
import {v4} from "uuid";


const SnapshotSchema = new mongoose.Schema({
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
    state: {
        type: Object,
        required: true
    },
    timestamp: {
        type: Date,
        required: true
    }

})

// one snapshot per position per stream; re-snapshotting a position upserts instead of duplicating
SnapshotSchema.index({ streamId: 1, streamPosition: 1 }, { unique: true });

const SnapshotModel = mongoose.model('Snapshot', SnapshotSchema , 'Snapshot' )

export default SnapshotModel;
