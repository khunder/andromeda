import test from "ava";
import {EventStore} from "./event-store.js";
import {v4} from "uuid";
import PersistenceModule from "../persistence.module.js";




test.before(async () => {
});

test.after(async () => {
})





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
            data:{
                id: v4(),
                deploymentId: "deploymentId",
                processDef: "processDef",
                status: 0,
                containerId: v4()
            },
            timestamp: new Date().toString()
        });

        await EventStore.apply({
            id: v4(),
            streamId: "PROCESS_INSTANCE",
            type: "CREATE_PROCESS_INSTANCE",
            streamPosition: 0,
            data:{
                id: v4(),
                deploymentId: "deploymentId",
                processDef: "processDef",
                status: 0,
                containerId: v4()
            },
            timestamp: new Date().toString()
        });
        t.pass();

    })



test('Create/Close process instance',
    /**
     *
     * @param {Assertions}t
     * @returns {Promise<void>}
     */
    async (t) => {
        await PersistenceModule.init();
        const processInstancesId= v4();
        await EventStore.apply({
            id:  v4(),
            streamId: "PROCESS_INSTANCE",
            type: "CREATE_PROCESS_INSTANCE",
            streamPosition: 0,
            data:{
                id: processInstancesId,
                deploymentId: "deploymentId",
                processDef: "processDef",
                status: 0,
                containerId: v4()
            },
            timestamp: new Date().toString()
        });

        await EventStore.apply({
            id:  v4(),
            streamId: "PROCESS_INSTANCE",
            type: "CLOSE_PROCESS_INSTANCE",
            streamPosition: 0,
            data:{
                id: processInstancesId,
                containerId: v4()
            },
            timestamp: new Date().toString()
        });
        t.pass();

    })



