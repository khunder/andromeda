

const ProcessInstance =  require("./models/process.instance");
const RepositoryBase= require("./repository.base");
const mongoose = require("mongoose");



describe("Engine lifecycle", () => {
    let server;
    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI);
    });

    afterAll( async ()=>{
        await mongoose.disconnect();
    })

    test('Start Engine', async () => {
        try{
            let repo = new RepositoryBase(ProcessInstance);
            let ee = await repo.count()
            console.log(ee);

        }catch (e) {
            console.error(e)
        }

    })


})