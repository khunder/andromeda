import assert from "assert";
import {v4} from "uuid";
import {StreamCounterRepository} from "./stream-counter.repository.js";

// Regression coverage for the multi-pod duplicate-key bug: streamPosition
// used to be a per-process in-memory counter, so two container replicas
// racing to append to the same stream could both compute the same "next"
// position and collide on the unique (streamId, streamPosition) index.
// StreamCounterRepository.reserveNext() is the atomic replacement.
//
// Important honesty about what this file can and can't prove: within a
// single process, even the *old* buggy counter never actually raced under
// concurrent async calls - Node is single-threaded and the old code had no
// `await` between reading and incrementing it, so it was accidentally safe
// for one process regardless of how many promises were in flight. The real
// bug only ever manifested across genuinely separate OS processes (two
// pods), which a same-process test structurally cannot reproduce. What
// *can* be usefully guarded here is the actual persisted-counter code path
// (reserveNextSqlite - which does have a genuine `await` before its
// read-modify-write, unlike the in-memory fake path below): a future change
// that slips an `await` in between the read and the write there would
// reintroduce a real same-process race, and these tests would catch it.
// The Mongo path's cross-process safety comes from MongoDB's own atomic
// `$inc`/`$max`, not from anything testable without a real server - that's
// covered end-to-end by timer-start-event-two-container-race.int.test.js
// (two real processes, real MongoDB), not here.
describe('StreamCounterRepository', function () {

    it('reserveNext hands out unique, sequential positions starting at 0', async () => {
        const streamId = `unit_test_${v4()}`;
        const repo = new StreamCounterRepository();
        assert.equal(await repo.reserveNext(streamId), 0);
        assert.equal(await repo.reserveNext(streamId), 1);
        assert.equal(await repo.reserveNext(streamId), 2);
    });

    it('reserveNext never hands out the same position twice under concurrent callers', async () => {
        const streamId = `unit_test_${v4()}`;
        const repo = new StreamCounterRepository();
        const concurrency = 50;

        const positions = await Promise.all(
            Array.from({length: concurrency}, () => repo.reserveNext(streamId)),
        );

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

    it('keeps two independently-created streams\' counters fully isolated from each other', async () => {
        const streamA = `unit_test_${v4()}`;
        const streamB = `unit_test_${v4()}`;
        const repo = new StreamCounterRepository();

        assert.equal(await repo.reserveNext(streamA), 0);
        assert.equal(await repo.reserveNext(streamA), 1);
        // streamB has never reserved before - must start at 0 regardless of
        // how far streamA has already advanced
        assert.equal(await repo.reserveNext(streamB), 0);
        assert.equal(await repo.reserveNext(streamA), 2);
    });

    it('ensureAtLeast ratchets the counter forward but never backward', async () => {
        const streamId = `unit_test_${v4()}`;
        const repo = new StreamCounterRepository();

        await repo.ensureAtLeast(streamId, 10);
        assert.equal(await repo.reserveNext(streamId), 10);

        // a lower minimum than the counter already reached must not roll it back
        await repo.ensureAtLeast(streamId, 3);
        assert.equal(await repo.reserveNext(streamId), 11);
    });
});
