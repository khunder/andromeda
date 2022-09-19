import {EventStore} from "../lib/event-store.js";
import {v4} from "uuid";
import {EventTypes} from "../event-types.js";
import {StreamIds} from "../streams/stream-ids.js";
import {PersistenceHelper} from "../../helper/persistence-helper.js";
import {FlowEventStatus} from "../internal/models/flow-event.orm-model.js";
import assert from "assert";


describe('Persistence::Flow Event', function () {


    it('Inert flow event',
        /**
         *
         * @returns {Promise<void>}
         */
        async () => {
            const processInstance = v4()
            await EventStore.apply({
                id: v4(),
                streamId: StreamIds.FLOW_EVENT,
                type: EventTypes.CREATE_FLOW_EVENT,
                streamPosition: 0,
                data: {
                    processInstance: processInstance,
                    flowId: "flow_id",
                    status: FlowEventStatus.Active
                },
                timestamp: new Date().toString()
            });
            const record = await PersistenceHelper.findRecord("FlowEvent", {processInstance})
            assert.ok(record);
            assert.equal(record.processInstance, processInstance)
            assert.equal(record.status, FlowEventStatus.Active)

        })


    it('Close flow event',
        /**
         *
         * @param {Assertions}t
         * @returns {Promise<void>}
         */
        async () => {
            const processInstance = v4()
            await EventStore.apply({
                id: v4(),
                streamId: StreamIds.FLOW_EVENT,
                type: EventTypes.CREATE_FLOW_EVENT,
                streamPosition: 0,
                data: {
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
                data: {
                    processInstance: processInstance,
                    flowId: "flow_id",
                },
                timestamp: new Date().toString()
            });


            const record = await PersistenceHelper.findRecord("FlowEvent", {processInstance})
            assert.ok(record);
            assert.equal(record.status, FlowEventStatus.Completed)

        })


    it('Abort flow event',
        /**
         *
         * @param {Assertions}t
         * @returns {Promise<void>}
         */
        async () => {
            const processInstance = v4()
            await EventStore.apply({
                id: v4(),
                streamId: StreamIds.FLOW_EVENT,
                type: EventTypes.CREATE_FLOW_EVENT,
                streamPosition: 0,
                data: {
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
                data: {
                    processInstance: processInstance,
                    flowId: "flow_id",
                },
                timestamp: new Date().toString()
            });


            const record = await PersistenceHelper.findRecord("FlowEvent", {processInstance})
            assert.ok(record);
            assert.equal(record.status, FlowEventStatus.Aborted)

        })


    it('Fail flow event',
        /**
         *
         * @param {Assertions}t
         * @returns {Promise<void>}
         */
        async () => {
            const processInstance = v4()
            await EventStore.apply({
                id: v4(),
                streamId: StreamIds.FLOW_EVENT,
                type: EventTypes.CREATE_FLOW_EVENT,
                streamPosition: 0,
                data: {
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
                data: {
                    processInstance: processInstance,
                    flowId: "flow_id",
                },
                timestamp: new Date().toString()
            });


            const record = await PersistenceHelper.findRecord("FlowEvent", {processInstance})
            assert.ok(record);
            assert.equal(record.status, FlowEventStatus.Error)

        })


});

