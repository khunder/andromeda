
import ProcessInstance from "../models/process.instance.js";
import mongoose from "mongoose";
import {v4} from "uuid";
import {ProcessInstanceRepository} from "./process-instance.repository.js";


describe("ProcessInstance Repository", () => {
    let server;
    let db;

    /**
     * @type {ProcessInstanceRepository}
     */

    beforeAll(async () => {
        await mongoose.connect("mongodb://127.0.0.1:27017/andromeda");
        db = mongoose.connection.db
    });

    afterAll( async ()=>{
        await mongoose.disconnect();
    })


    it('wee', async () => {
        const id = v4();
        const processInstanceRepository= new ProcessInstanceRepository();
        await processInstanceRepository.createNewProcessInstance(id, "deploymentID", "processDef")
        const processInstanceCollection = db.collection('ProcessInstance');
        const res = await processInstanceCollection.findOne({_id: id})
        expect(res).toBeTruthy();
    });


})