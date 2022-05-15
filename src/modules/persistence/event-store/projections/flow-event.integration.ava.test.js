import test from "ava";
import {EventStore} from "../lib/event-store.js";
import {v4} from "uuid";
import PersistenceModule from "../../persistence.module.js";
import {EventTypes} from "../event-types.js";
import {StreamIds} from "../streams/stream-ids.js";
import {PersistenceHelper} from "../../helper/persistence-helper.js";
import {FlowEventStatus} from "../internal/models/flow-event.orm-model.js";




test.before(async () => {
    await PersistenceModule.init();
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
        const processInstance = v4()
        await EventStore.apply({
            id: v4(),
            streamId: StreamIds.FLOW_EVENT,
            type: EventTypes.CREATE_FLOW_EVENT,
            streamPosition: 0,
            data:{
                processInstance: processInstance,
                flowId: "flow_id",
                status: FlowEventStatus.Active
            },
            timestamp: new Date().toString()
        });
        const record = await PersistenceHelper.findRecord("FlowEvent", {processInstance})
        t.truthy(record);
        t.is(record.processInstance , processInstance)
        t.is(record.status , FlowEventStatus.Active)

    })


test('Close flow event',
    /**
     *
     * @param {Assertions}t
     * @returns {Promise<void>}
     */
    async (t) => {
        const processInstance = v4()
        await EventStore.apply({
            id: v4(),
            streamId: StreamIds.FLOW_EVENT,
            type: EventTypes.CREATE_FLOW_EVENT,
            streamPosition: 0,
            data:{
                processInstance: processInstance,
                flowId: "flow_id",
                status: FlowEventStatus.Active
            },
            timestamp: new Date().toString()
        });

        await EventStore.apply({
            id: v4(),
            streamId: StreamIds.FLOW_EVENT,
            type: EventTypes.CLOSE_FLOW_EVENT,
            streamPosition: 0,
            data:{
                processInstance: processInstance,
                flowId: "flow_id",
            },
            timestamp: new Date().toString()
        });


        const record = await PersistenceHelper.findRecord("FlowEvent", {processInstance})
        t.truthy(record);
        t.is(record.status , FlowEventStatus.Completed)

    })


test('Abort flow event',
    /**
     *
     * @param {Assertions}t
     * @returns {Promise<void>}
     */
    async (t) => {
        const processInstance = v4()
        await EventStore.apply({
            id: v4(),
            streamId: StreamIds.FLOW_EVENT,
            type: EventTypes.CREATE_FLOW_EVENT,
            streamPosition: 0,
            data:{
                processInstance: processInstance,
                flowId: "flow_id",
                status: FlowEventStatus.Active
            },
            timestamp: new Date().toString()
        });

        await EventStore.apply({
            id: v4(),
            streamId: StreamIds.FLOW_EVENT,
            type: EventTypes.ABORT_FLOW_EVENT,
            streamPosition: 0,
            data:{
                processInstance: processInstance,
                flowId: "flow_id",
            },
            timestamp: new Date().toString()
        });


        const record = await PersistenceHelper.findRecord("FlowEvent", {processInstance})
        t.truthy(record);
        t.is(record.status , FlowEventStatus.Aborted)

    })


test('Fail flow event',
    /**
     *
     * @param {Assertions}t
     * @returns {Promise<void>}
     */
    async (t) => {
        const processInstance = v4()
        await EventStore.apply({
            id: v4(),
            streamId: StreamIds.FLOW_EVENT,
            type: EventTypes.CREATE_FLOW_EVENT,
            streamPosition: 0,
            data:{
                processInstance: processInstance,
                flowId: "flow_id",
                status: FlowEventStatus.Active
            },
            timestamp: new Date().toString()
        });

        await EventStore.apply({
            id: v4(),
            streamId: StreamIds.FLOW_EVENT,
            type: EventTypes.FAIL_FLOW_EVENT,
            streamPosition: 0,
            data:{
                processInstance: processInstance,
                flowId: "flow_id",
            },
            timestamp: new Date().toString()
        });


        const record = await PersistenceHelper.findRecord("FlowEvent", {processInstance})
        t.truthy(record);
        t.is(record.status , FlowEventStatus.Error)

    })




