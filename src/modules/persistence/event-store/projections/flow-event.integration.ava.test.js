import test from "ava";
import {EventStore} from "../lib/event-store.js";
import {v4} from "uuid";
import PersistenceModule from "../../persistence.module.js";
import mongoose from "mongoose";
import {ProcessInstanceStatus} from "../internal/models/process-instance.orm-model.js";
import {EventTypes} from "../event-types.js";
import {StreamIds} from "../streams/stream-ids.js";




test.before(async () => {
});

test.after(async () => {
})





test('Inert flow event',
    /**
     *
     * @param {Assertions}t
     * @returns {Promise<void>}
     */
    async (t) => {
        await PersistenceModule.init();
        await EventStore.apply({
            id: v4(),
            streamId: StreamIds.FLOW_EVENT,
            type: EventTypes.CREATE_FLOW_EVENT,
            streamPosition: 0,
            data:{
                processInstance: v4(),
                flowId: "flow_id",
            },
            timestamp: new Date().toString()
        });

        t.pass();

    })





