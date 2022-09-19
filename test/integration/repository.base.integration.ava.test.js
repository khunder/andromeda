
import mongoose from "mongoose";
import {v4} from "uuid";
import TestModel from "../../src/modules/persistence/event-store/internal/models/test-model.js";
import assert from "assert";
import BaseRepository from "../../src/modules/persistence/event-store/repositories/baseRepository.js";
import ProcessInstanceModel
    from "../../src/modules/persistence/event-store/internal/models/process-instance.orm-model.js";


describe('Repository Base::Integration', function () {
    let db;
    before(async () => {
        await mongoose.connect(process.env.MONGODB_URI);
        db = mongoose.connection.db
    });

    after( async ()=>{
        await mongoose.disconnect();
    })


    it('Count repository',
        /**
         *
         * @param  {Assertions} t
         * @returns {Promise<void>}
         */
        async () => {
        try{
            const id = v4()
            const notFoundId = v4()
            let repo = new BaseRepository(TestModel);
            const count = await repo.count({_id: id})
            assert.equal(count, 0);
            await repo.create({_id: id, value : "val" })
            assert.equal(await repo.count({_id: id}), 1);
            assert.equal(await repo.count({_id: notFoundId}), 0);
            await repo.delete(id)
            assert.equal(await repo.count({_id: id}), 0);
            
        }catch (e) {
            console.error(e)
        }

    })


    it('upsert repository',
        /**
         *
         * @param  {Assertions} t
         * @returns {Promise<void>}
         */
        async () => {
            try{
                const id = v4()
                let repo = new BaseRepository(ProcessInstanceModel);
                const count = await repo.count({_id: id})
                assert.equal(count, 0);
                await repo.upsert({_id: id}, {_id: id, value : "val"})
                assert.equal(await repo.count({_id: id}), 1);
                await repo.upsert({_id: id}, {_id: id, value : "val"})
                assert.equal(await repo.count({_id: id}), 1);
                await repo.delete(id)
                assert.equal(await repo.count({_id: id}), 0);
                
            }catch (e) {
                console.error(e)
            }

        })
});
