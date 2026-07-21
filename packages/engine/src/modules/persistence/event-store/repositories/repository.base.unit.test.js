import {v4} from "uuid";
import assert from "assert";
import FakeRepositoryBase from "../internal/fake.repository.base.js";
import ProcessInstanceModel from "../internal/models/process-instance.orm-model.js";

describe('Event store repository', function () {


    it('Count repository',
        /**
         *
         * @param {Assertions}t
         * @returns {Promise<void>}
         */
        async () => {
            try {
                let repo = new FakeRepositoryBase(ProcessInstanceModel);
                const count = await repo.count()
                assert.equal(count, 0)
                await repo.create({_id: v4()})
                assert.equal(await repo.count(), 1)

            } catch (e) {
                console.error(e)
            }
        })

});