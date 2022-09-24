import mongoose from "mongoose";
import {v4} from 'uuid';

import assert from "assert";
import {
    ProcessInstanceRepository
} from "../../src/modules/persistence/event-store/repositories/process-instance.repository.js";
import PersistenceModule from "../../src/modules/persistence/persistence.module.js";


describe('ProcessInstanceRepo::Basic', function () {


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
            const processInstanceCollection = PersistenceModule.getConnection().db.collection('ProcessInstance');
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
            const processInstanceCollection = PersistenceModule.getConnection().db.collection('ProcessInstance');
            const res = await processInstanceCollection.findOne({_id: id})
            assert.ok(res);
            assert.equal(res.lock, null)
            ;
        });
});
