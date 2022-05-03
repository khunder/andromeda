
import mongoose from "mongoose";
import {v4} from "uuid";


const EventStoreSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: v4(),
    },
    streamId: {
        type: String,
        required: true
    },
    streamPosition: {
        type: Number,
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

const EventStoreModel = mongoose.model('EventStore', EventStoreSchema , 'EventStore' )

export default EventStoreModel;