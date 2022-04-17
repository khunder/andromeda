
import ProcessInstance from "./models/process.instance.js";
import FakeRepositoryBase from "./fake.repository.base.js";
import mongoose from "mongoose";


describe("Engine lifecycle", () => {
    let server;
    before(async () => {
        await mongoose.connect(process.env.MONGO_URL);
    });

    after( async ()=>{
        await mongoose.disconnect();
    })


    it('Start Engineqq', async () => {
        try{
            let repo = new FakeRepositoryBase(ProcessInstance);
            await repo.count()


        }catch (e) {
            console.error(e)
        }

    })

    it('doit insérer un doc dans la collection', async () => {
        const users = db.collection('users');

        const mockUser = {_id: 'some-user-id', name: 'John'};
        await users.insertOne(mockUser);

        const insertedUser = await users.findOne({_id: 'some-user-id'});
        expect(insertedUser).toEqual(mockUser);
    });


})