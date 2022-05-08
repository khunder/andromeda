import test from "ava";
import {EventStore} from "./event-store.js";
import {v4} from "uuid";
import {StreamIds} from "./streams/stream-ids.js";
import {TestStreamBuilder} from "./streams/test/test.stream-builder.js";
import Utils from "../../../utils/utils.js";




test.before(async () => {
    process.env.isUnitTestMode = true
    new TestStreamBuilder().build()
});

test.after(async () => {
})



test('Valid empty event',
    /**
     *
     * @param {Assertions}t
     * @returns {Promise<void>}
     */
    async (t) => {
        await EventStore.apply({
            id: v4(),
            streamId: "TEST",
            type: "TEST",
            streamPosition: 0,
            timestamp: new Date().toString()
        });
        t.pass();

    })

test('not Valid empty event',
    /**
     *
     * @param {Assertions}t
     * @returns {Promise<void>}
     */
    async (t) => {

        const error2 = await Utils.getError(() =>  EventStore.apply({
            id: v4(),
            streamPosition: 0,
            type: "TEST",
            timestamp: new Date().toString()
        }));
        t.deepEqual(error2[0].message, "must have required property 'streamId'");


        const error3 = await Utils.getError(() =>  EventStore.apply({
            streamId: StreamIds.TEST,
            type: "TEST",
            streamPosition: 0,
            timestamp: new Date().toString()
        }));
        t.deepEqual(error3[0].message, "must have required property 'id'");

        const error4 = await Utils.getError(() =>  EventStore.apply({
            id: v4(),
            streamId: StreamIds.TEST,
            type: "TEST",
            streamPosition: 0,
        }));
        t.deepEqual(error4[0].message, "must have required property 'timestamp'");

        const error5 = await Utils.getError(() =>  EventStore.apply({
            id: v4(),
            streamId: StreamIds.TEST,
            streamPosition: 0,
            timestamp: new Date().toString()
        }));
        t.deepEqual(error5[0].message, "must have required property 'type'");
    })



test('Valid event with data and meta',
    /**
     *
     * @param {Assertions}t
     * @returns {Promise<void>}
     */
    async (t) => {
        const notFoundStreamId = "NOT_FOUND_STREAM_ID"
        const error = await Utils.getError(async () => await EventStore.apply({
            id: v4(),
            streamId: notFoundStreamId,
            type: "TEST",
            streamPosition: 0,
            data: {test: ""},
            metadata: {test: ""},
            timestamp: new Date().toString()
        }));
        t.deepEqual(error.message, `cannot find am aggregator for the streamId: ${notFoundStreamId}`);

        t.pass();

    })

test('Treat event',
    /**
     *
     * @param {Assertions}t
     * @returns {Promise<void>}
     */
    async (t) => {
        const notFoundStreamId = "NOT_FOUND_STREAM_ID"
        const error = await Utils.getError(async () => await EventStore.apply({
            id: v4(),
            streamId: notFoundStreamId,
            type: "TEST",
            streamPosition: 0,
            data: {test: ""},
            metadata: {test: ""},
            timestamp: new Date().toString()
        }));
        t.deepEqual(error.message, `cannot find am aggregator for the streamId: ${notFoundStreamId}`);

        t.pass();

    })



