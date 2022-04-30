import ProcessInstance from "../models/process.instance.js";
import mongoose from "mongoose";
import { v4} from 'uuid';
import {ProcessInstanceRepository} from "./process-instance.repository.js";
import test from "ava";


/**
 * @type {Db}
 */
let db;
const id = v4();

test.before(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    db = mongoose.connection.db
});

test.after(async () => {
    await db.collection('ProcessInstance').deleteOne({_id: id});
    await mongoose.disconnect();
})


test('create new Process instances',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {
        const processInstanceRepository = new ProcessInstanceRepository();
        await processInstanceRepository.createNewProcessInstance(id, "deploymentID", "processDef")
        const processInstanceCollection = db.collection('ProcessInstance');
        const res = await processInstanceCollection.findOne({_id: id})
        t.truthy(res);
        t.is(res.deploymentId , "deploymentID")
        t.pass();
    });

