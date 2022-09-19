import mongoose from "mongoose";
import {v4} from 'uuid';

import assert from "assert";
import {
    ProcessInstanceRepository
} from "../../src/modules/persistence/event-store/repositories/process-instance.repository.js";


describe('ProcessInstanceRepo::Basic', function () {
    /**
     * @type {Db}
     */
    let db;

    before(async () => {
        db = mongoose.connection.db
    });


    it('create new Process instances',
        /**
         *
         * @param {Assertions} t
         * @returns {Promise<void>}
         */
        async () => {
            const id = v4();
            const processInstanceRepository = new ProcessInstanceRepository();
            const containerId = v4();
            await processInstanceRepository.createNewProcessInstance(id, "deploymentID", "processDef", containerId)
            const processInstanceCollection = db.collection('ProcessInstance');
            const res = await processInstanceCollection.findOne({_id: id})
            assert.ok(res);
            assert.equal(res.deploymentId, "deploymentID")
            assert.ok(res.lock)
            ;
        });

    it('remove Process instances lock',
        /**
         *
         * @param {Assertions} t
         * @returns {Promise<void>}
         */
        async () => {
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
            assert.ok(res);
            assert.equal(res.lock, null)
            ;
        });
});
