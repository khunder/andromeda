
import ProcessInstance from "./models/process.instance.js";
import FakeRepositoryBase from "./fake.repository.base.js";



describe("Repository base", () => {


    it('Start Engine', async () => {
        try{
            let repo = new FakeRepositoryBase(ProcessInstance);
            await repo.count()


        }catch (e) {
            console.error(e)
        }

    })


})