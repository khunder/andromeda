import ProcessInstanceModel from "../../src/modules/persistence/event-store/internal/models/processInstanceModel.js";
import mongoose from "mongoose";
import {v4} from 'uuid';
import {ProcessInstanceRepository} from "../../src/modules/persistence/event-store/internal/process-instance.repository.js";
import test from "ava";


/**
 * @type {Db}
 */
let db;

test.before(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    db = mongoose.connection.db
});

test.after(async () => {
    // await db.collection('ProcessInstance').deleteOne({_id: id});
    await mongoose.disconnect();
})


test('create new Process instances',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {
        const id = v4();
        const processInstanceRepository = new ProcessInstanceRepository();
        const containerId = v4();
        await processInstanceRepository.createNewProcessInstance(id, "deploymentID", "processDef", containerId)
        const processInstanceCollection = db.collection('ProcessInstance');
        const res = await processInstanceCollection.findOne({_id: id})
        t.truthy(res);
        t.is(res.deploymentId, "deploymentID")
        t.truthy(res.lock)
        t.pass();
    });

test('remove Process instances lock',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {
        // given
        const id = v4();
        const processInstanceRepository = new ProcessInstanceRepository();
        const containerId = v4();
        await processInstanceRepository.createNewProcessInstance(id, "deploymentID", "processDef", containerId)
        // when
        await processInstanceRepository.removeLock(id)
        //then
        const processInstanceCollection = db.collection('ProcessInstance');
        const res = await processInstanceCollection.findOne({_id: id})
        t.truthy(res);
        t.is(res.lock, null)
        t.pass();
    });

