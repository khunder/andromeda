import test from "ava";
import {EventStore} from "./event-store.js";
import {v4} from "uuid";
import {StreamAggregatorIds} from "./streams/stream-aggregator-ids.js";




test.before(async () => {
    process.env.isUnitTestMode = true
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
            type: "type",
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

        const error = await getError(() =>  EventStore.apply({
            id: v4(),
            streamId: StreamAggregatorIds.TEST,
            type: "TEST",
            timestamp: new Date().toString()
        }));
        t.deepEqual(error[0].message, "must have required property 'streamPosition'");

        const error2 = await getError(() =>  EventStore.apply({
            id: v4(),
            streamPosition: 0,
            type: "TEST",
            timestamp: new Date().toString()
        }));
        t.deepEqual(error2[0].message, "must have required property 'streamId'");


        const error3 = await getError(() =>  EventStore.apply({
            streamId: StreamAggregatorIds.TEST,
            type: "TEST",
            streamPosition: 0,
            timestamp: new Date().toString()
        }));
        t.deepEqual(error3[0].message, "must have required property 'id'");

        const error4 = await getError(() =>  EventStore.apply({
            id: v4(),
            streamId: StreamAggregatorIds.TEST,
            type: "TEST",
            streamPosition: 0,
        }));
        t.deepEqual(error4[0].message, "must have required property 'timestamp'");

        const error5 = await getError(() =>  EventStore.apply({
            id: v4(),
            streamId: StreamAggregatorIds.TEST,
            streamPosition: 0,
            timestamp: new Date().toString()
        }));
        t.deepEqual(error5[0].message, "must have required property 'type'");
    })

test('Fire error when event type is not supported',
    /**
     *
     * @param {Assertions}t
     * @returns {Promise<void>}
     */
    async (t) => {

        const error = await getError(() => EventStore.apply({
            id: v4(),
            streamId: StreamAggregatorIds.TEST,
            type: "TEST",
            timestamp: new Date().toString()
        }));
        t.deepEqual(error[0].message, "must have required property 'streamPosition'");

    })


test('Valid event with data and meta',
    /**
     *
     * @param {Assertions}t
     * @returns {Promise<void>}
     */
    async (t) => {
        const notFoundStreamId = "NOT_FOUND_STREAM_ID"
        const error = await getError(async () => await EventStore.apply({
            id: v4(),
            streamId: notFoundStreamId,
            type: "type",
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
        const error = await getError(async () => await EventStore.apply({
            id: v4(),
            streamId: notFoundStreamId,
            type: "type",
            streamPosition: 0,
            data: {test: ""},
            metadata: {test: ""},
            timestamp: new Date().toString()
        }));
        t.deepEqual(error.message, `cannot find am aggregator for the streamId: ${notFoundStreamId}`);

        t.pass();

    })



