

// const ProcessInstance =  require("./models/process.instance");
// const RepositoryBase= require("./repository.base");
// const mongoose = require("mongoose");



import mongoose from "mongoose";
import RepositoryBase from "./repository.base.js";
import ProcessInstance from "./models/process.instance.js";

describe("Engine lifecycle", () => {
    let server;
    beforeAll(async () => {
        await mongoose.connect(process.env.MONGO_URL);
    });

    afterAll( async ()=>{
        await mongoose.disconnect();
    })

    test('Start Engine', async () => {
        try{
            let repo = new RepositoryBase(ProcessInstance);
            let ee = await repo.count()

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