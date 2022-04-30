
import ProcessInstance from "./models/process.instance.js";
import FakeRepositoryBase from "./repositories/fake.repository.base.js";
import mongoose from "mongoose";
import test from "ava";
import {v4} from "uuid";


test.before(async () => {
});

test.after( async ()=>{
})


test('Count repository',
    /**
     *
     * @param {Assertions}t
     * @returns {Promise<void>}
     */
    async (t) => {
        try{
            let repo = new FakeRepositoryBase(ProcessInstance);
            const count =await repo.count()
            t.is(count, 0)
            await repo.create({_id: v4()})
            t.is(await repo.count(), 1)
            t.pass()
        }catch (e) {
            console.error(e)
        }
    })

