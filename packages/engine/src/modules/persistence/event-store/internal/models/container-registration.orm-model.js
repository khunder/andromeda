
import mongoose from "mongoose";
import {v4} from "uuid";

// One document per (deploymentId, version, containerId) - the unique index is
// the actual registration mechanism: every running container replica upserts
// only its own row on this key, so concurrent replicas of the same deployment
// (or the same deployment redeployed at a different version) never race to
// write the same document. Liveness is a plain query for rows whose
// lastHeartbeat falls within the expected heartbeat window - see
// ContainerRegistrationRepository.findRunning().
const ContainerRegistrationSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => v4()
    },
    deploymentId: {
        type: String,
        required: true
    },
    // not required at the schema level: version is enforced at the
    // compile/run-embedded API boundary for newly started containers, but
    // the heartbeat write itself must never fail just because a given
    // container process wasn't given one (older deployments, direct/internal
    // starts, etc.) - see ContainerService.registerHeartbeat().
    version: {
        type: String
    },
    containerId: {
        type: String,
        required: true
    },
    lastHeartbeat: {
        type: Date,
        required: true
    }
}, {timestamps: true})

ContainerRegistrationSchema.index({deploymentId: 1, version: 1, containerId: 1}, {unique: true});

const ContainerRegistrationModel = mongoose.model('ContainerRegistration', ContainerRegistrationSchema, 'ContainerRegistration')

export default ContainerRegistrationModel;
