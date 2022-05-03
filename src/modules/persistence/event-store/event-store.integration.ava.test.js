import test from "ava";
import {EventStore} from "./event-store.js";
import {v4} from "uuid";
import PersistenceModule from "../persistence.module.js";




test.before(async () => {
});

test.after(async () => {
})


const getError = async (call) => {
    try {
        await call();
    } catch (error) {
        return error;
    }
};



test('Inert event',
    /**
     *
     * @param {Assertions}t
     * @returns {Promise<void>}
     */
    async (t) => {
        await PersistenceModule.init();
        await EventStore.apply({
            id: v4(),
            streamId: "PROCESS_INSTANCE",
            type: "CREATE_PROCESS_INSTANCE",
            streamPosition: 0,
            timestamp: new Date().toString()
        });
        t.pass();

    })



