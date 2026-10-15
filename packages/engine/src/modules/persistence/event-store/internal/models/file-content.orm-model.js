import mongoose from "mongoose";

// Content of small files bound to file variables (at most the containers'
// FILE_INLINE_MAX_BYTES, 256 KiB by default) - bigger ones live in object
// storage. Keyed by the same object key the object storage would use
// (<deploymentId>/<version>/<processInstanceId>/<nodeId>/<fileName>).
// Deliberately NOT event-sourced: the event log only ever records a file
// variable's metadata and sha256, never the bytes - same reasoning as the
// EngineTimer collection being a plain store.
const FileContentSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    contentType: {
        type: String,
        default: 'application/octet-stream'
    },
    size: {
        type: Number,
        required: true
    },
    sha256: {
        type: String,
        required: true
    },
    // base64
    data: {
        type: String,
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, {timestamps: true, _id: false})

const FileContentModel = mongoose.model('FileContent', FileContentSchema, 'FileContent')

export default FileContentModel;
