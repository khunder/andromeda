
import ProcessInstance from "./models/process.instance.js";
import FakeRepositoryBase from "./repositories/fake.repository.base.js";
import mongoose from "mongoose";
import test from "ava";
import {ProcessInstanceRepository} from "./repositories/process-instance.repository.js";
import BaseRepository from "./repositories/baseRepository.js";
import {v4} from "uuid";


    let db;
    test.before(async () => {
        await mongoose.connect(process.env.MONGODB_URI);
        db = mongoose.connection.db
    });

    test.after( async ()=>{
        await mongoose.disconnect();
    })


    test('Count repository',
        /**
         *
         * @param  {Assertions} t
         * @returns {Promise<void>}
         */
        async (t) => {
        try{
            const id = v4()
            const notFoundId = v4()
            let repo = new BaseRepository(ProcessInstance);
            const count = await repo.count()
            t.is(count, 0);
            await repo.create({_id: id, deploymentId : "deploymentId" , processDef: "processDef"})
            t.is(await repo.count(), 1);
            t.is(await repo.count({_id: id}), 1);
            t.is(await repo.count({_id: notFoundId}), 0);
            await repo.delete(id)
            t.pass()
            t.is(await repo.count(), 0);
        }catch (e) {
            console.error(e)
        }

    })

    // test('doit insérer un doc dans la collection', async (t) => {
    //     const users = db.collection('users');
    //
    //     const mockUser = {_id: 'some-user-id', name: 'John'};
    //     await users.insertOne(mockUser);
    //
    //     const insertedUser = await users.findOne({_id: 'some-user-id'});
    //     t.is(insertedUser, mockUser);
    // })


