
import mongoose from "mongoose";
import {v4} from "uuid";



const testModelSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: v4()
    },

    value: {
        type: String,
        required: true
    },

})

const TestModel = mongoose.model('TestModel', testModelSchema , 'TestModel' )

export default TestModel;