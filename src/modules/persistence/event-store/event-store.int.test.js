import {EventStore} from "./lib/event-store.js";
import {v4} from "uuid";
import {StreamIds} from "./streams/stream-ids.js";
import {TestStreamBuilder} from "./streams/test/test.stream-builder.js";
import Utils from "../../../utils/utils.js";
import assert from "assert";


describe('Event store', function () {


    before(async () => {
        process.env.isUnitTestMode = true
        new TestStreamBuilder().build()
    });

    after(async () => {
    })


    it('Valid empty event',
        /**
         *
         * @param {Assertions}t
         * @returns {Promise<void>}
         */
        async () => {
            await EventStore.apply({
                id: v4(),
                streamId: "TEST",
                type: "TEST",
                streamPosition: 0,
                timestamp: new Date().toString()
            });


        })

    it('not Valid empty event',
        /**
         *
         * @returns {Promise<void>}
         */
        async () => {
            const event2 = {
                id: v4(),
                streamPosition: 0,
                type: "TEST",
                timestamp: new Date().toString()
            }
            const error2 = await Utils.getError(() => EventStore.apply(event2));
            assert.equal(error2.message, `cannot validate event ${JSON.stringify(event2)}`);


            const event3  = {
                streamId: StreamIds.TEST,
                type: "TEST",
                streamPosition: 0,
                timestamp: new Date().toString()
            }
            const error3 = await Utils.getError(() => EventStore.apply(event3));
            assert.equal(error3.message, `cannot validate event ${JSON.stringify(event3)}`);

            const event4= {
                id: v4(),
                streamId: StreamIds.TEST,
                type: "TEST",
                streamPosition: 0,
            }
            const error4 = await Utils.getError(() => EventStore.apply(event4));
            assert.equal(error4.message, `cannot validate event ${JSON.stringify(event4)}`);

            const event5 = {
                id: v4(),
                streamId: StreamIds.TEST,
                streamPosition: 0,
                timestamp: new Date().toString()
            }
            const error5 = await Utils.getError(() => EventStore.apply(event5));
            assert.equal(error5.message, `cannot validate event ${JSON.stringify(event5)}`);
        })


    it('Valid event with data and meta',
        /**
         *
         * @param {Assertions}t
         * @returns {Promise<void>}
         */
        async () => {
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
            assert.equal(error.message, `cannot find am aggregator for the streamId: ${notFoundStreamId}`);


        })

    it('Treat event',
        /**
         *
         * @param {Assertions}t
         * @returns {Promise<void>}
         */
        async () => {
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
            assert.deepEqual(error.message, `cannot find am aggregator for the streamId: ${notFoundStreamId}`);

        })

});



