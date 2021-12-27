


const ProcessInstance =  require("./models/process.instance");
const FakeRepositoryBase= require("./fake.repository.base");



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