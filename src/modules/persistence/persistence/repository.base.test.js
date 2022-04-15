


const ProcessInstance =  require("./models/process.instance.js");
const FakeRepositoryBase= require("./fake.repository.base.js");



describe("Engine lifecycle", () => {
    let server;
    beforeAll(()=> {

    });

    test('Start Engine', async () => {
        try{
            let repo = new FakeRepositoryBase(ProcessInstance);
            repo.count()


        }catch (e) {
            console.error(e)
        }

    })


})