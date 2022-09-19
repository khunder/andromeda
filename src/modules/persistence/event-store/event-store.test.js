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

            const error2 = await Utils.getError(() => EventStore.apply({
                id: v4(),
                streamPosition: 0,
                type: "TEST",
                timestamp: new Date().toString()
            }));
            assert.deepEqual(error2.message, "cannot validate event with type TEST [{\"instancePath\":\"\",\"schemaPath\":\"#/required\",\"keyword\":\"required\",\"params\":{\"missingProperty\":\"streamId\"},\"message\":\"must have required property 'streamId'\"}]");


            const error3 = await Utils.getError(() => EventStore.apply({
                streamId: StreamIds.TEST,
                type: "TEST",
                streamPosition: 0,
                timestamp: new Date().toString()
            }));
            assert.deepEqual(error3[0].message, "must have required property 'id'");

            const error4 = await Utils.getError(() => EventStore.apply({
                id: v4(),
                streamId: StreamIds.TEST,
                type: "TEST",
                streamPosition: 0,
            }));
            assert.deepEqual(error4[0].message, "must have required property 'timestamp'");

            const error5 = await Utils.getError(() => EventStore.apply({
                id: v4(),
                streamId: StreamIds.TEST,
                streamPosition: 0,
                timestamp: new Date().toString()
            }));
            assert.deepEqual(error5[0].message, "must have required property 'type'");
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
            assert.deepEqual(error.message, `cannot find am aggregator for the streamId: ${notFoundStreamId}`);


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



