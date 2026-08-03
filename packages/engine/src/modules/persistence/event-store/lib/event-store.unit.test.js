import assert from "assert";
import {v4} from "uuid";
import {EventStore} from "./event-store.js";
import {Stream} from "./stream.js";

// Regression coverage for the multi-pod duplicate-key bug: two container
// replicas of the same deployment, both appending events to the same
// event-sourced stream (PROCESS_INSTANCE, FLOW_EVENT, ...) around the same
// moment, used to be able to compute the same "next" streamPosition (a
// per-process in-memory counter) and collide on the unique
// (streamId, streamPosition) index the instant they wrote concurrently.
// EventStore.updateStreamPosition() now reserves positions atomically via
// StreamCounterRepository - this proves the actual property that matters:
// N events applied concurrently to the same stream never end up with the
// same position, however their promises interleave. A throwaway stream is
// registered per test so this doesn't depend on any other test file having
// registered PROCESS_INSTANCE/FLOW_EVENT/etc first. Deliberately runs
// against this suite's default sqlite driver rather than unit-test/fake
// mode: the fake in-memory repository has no `await` between reading and
// writing, so it's accidentally race-free regardless of correctness (see
// stream-counter.repository.unit.test.js for why) - the real sqlite path
// does have a genuine async gap, so this is an actual regression guard for
// the full EventStore.apply() flow, not just StreamCounterRepository in
// isolation.
describe('EventStore concurrent apply', function () {

    function registerThrowawayStream() {
        const stream = new Stream(`unit_test_stream_${v4()}`);
        stream.eventsRegistry = {TEST: "TEST"};
        EventStore.registerStream(stream.streamId, stream);
        return stream;
    }

    it('assigns unique, sequential streamPosition values to events applied concurrently to the same stream', async () => {
        const stream = registerThrowawayStream();
        const concurrency = 25;
        const events = Array.from({length: concurrency}, () => ({
            id: v4(),
            streamId: stream.streamId,
            type: "TEST",
            timestamp: new Date().toISOString(),
        }));

        // fired all at once, unawaited, so their internal position
        // reservations genuinely interleave rather than running one at a
        // time - this is what would have reproduced the duplicate-key
        // collision under the old per-process counter
        await Promise.all(events.map((event) => EventStore.apply(event)));

        const positions = events.map((event) => event.streamPosition);
        assert.equal(
            new Set(positions).size,
            concurrency,
            `expected ${concurrency} unique positions, got ${new Set(positions).size}: ${JSON.stringify(positions)}`,
        );
        assert.deepEqual(
            [...positions].sort((a, b) => a - b),
            Array.from({length: concurrency}, (_, i) => i),
        );
    });

    it('keeps assigning unique positions across repeated concurrent bursts on the same stream', async () => {
        const stream = registerThrowawayStream();
        const seenPositions = new Set();

        for (let burst = 0; burst < 3; burst++) {
            const events = Array.from({length: 10}, () => ({
                id: v4(),
                streamId: stream.streamId,
                type: "TEST",
                timestamp: new Date().toISOString(),
            }));
            await Promise.all(events.map((event) => EventStore.apply(event)));
            events.forEach((event) => {
                assert.equal(seenPositions.has(event.streamPosition), false, `position ${event.streamPosition} reused across bursts`);
                seenPositions.add(event.streamPosition);
            });
        }

        assert.equal(seenPositions.size, 30);
    });

    it('does not let two different streams influence each other\'s positions', async () => {
        const streamA = registerThrowawayStream();
        const streamB = registerThrowawayStream();

        const eventA = {id: v4(), streamId: streamA.streamId, type: "TEST", timestamp: new Date().toISOString()};
        const eventB1 = {id: v4(), streamId: streamB.streamId, type: "TEST", timestamp: new Date().toISOString()};
        const eventB2 = {id: v4(), streamId: streamB.streamId, type: "TEST", timestamp: new Date().toISOString()};

        await EventStore.apply(eventA);
        await EventStore.apply(eventB1);
        await EventStore.apply(eventB2);

        // streamB has its own independent counter - must start at 0 again
        // regardless of streamA already having reserved position 0 too
        assert.equal(eventA.streamPosition, 0);
        assert.equal(eventB1.streamPosition, 0);
        assert.equal(eventB2.streamPosition, 1);
    });
});
