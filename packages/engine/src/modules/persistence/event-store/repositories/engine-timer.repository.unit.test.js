import assert from "assert";
import {v4} from "uuid";
import {EngineTimerRepository} from "./engine-timer.repository.js";

// Unit coverage for EngineTimerRepository, the Store durable-timers.js's
// TimerService drives for both the Timer Start Event and Timer
// Intermediate Catch Event mechanisms - see that file's own doc comment for
// why a single conditional update (claimDue()/settle()/fail()) is the
// entire cross-replica safety mechanism, and what it does/doesn't guarantee
// alongside a handler's own writes.
//
// Deliberately runs against this suite's default sqlite driver (see
// test/setup.js), not unit-test/fake mode - same reasoning the old
// timer-job.repository.unit.test.js gave: the fake in-memory repository
// doesn't implement the same query semantics (the {$lte: cutoff} condition
// claimDue() relies on, or matching a `null` cond field), so it would
// silently pass tests a real backend's query translation could still get
// wrong. Every test uses a fresh v4()-suffixed id and, since this test
// *file* shares one sqlite file/table across every test in it (per
// test/setup.js), always looks its own timer up by that id out of whatever
// claimDue() returns rather than assuming it comes back alone or first -
// other tests' due-but-not-yet-claimed rows (see "respects the limit") can
// legitimately share a claimDue() batch with this test's own row.
//
// Honesty about what this file can and can't prove: sql.js runs in-process
// with no genuine concurrency, so "only one caller can ever win a claim"
// can't be reproduced here as an actual race the way it would need to be to
// catch a regression under real parallel replicas - that guarantee
// ultimately comes from the conditional update being atomic at the database
// layer (MongoDB's findOneAndUpdate, or sqlite's single-threaded JS), not
// from anything this test constructs. What *is* meaningfully tested here is
// the query logic itself: that the lease condition is actually present and
// actually excludes an already-claimed, not-yet-expired row.
describe('EngineTimerRepository', function () {

    function id(prefix = 'timer') {
        return `${prefix}_${v4()}`;
    }

    // claimDue() may return other tests' due rows alongside this one's (see
    // the file-level comment above) - every test picks its own out by id
    // instead of assuming it comes back alone or first.
    async function claimOwn(repo, timerId, now, owner, leaseMs = 30_000, limit = 50) {
        const batch = await repo.claimDue(now, owner, leaseMs, limit);
        return batch.find((t) => t.id === timerId) || null;
    }

    describe('insert', () => {
        it('creates a new timer row at attempt 0, unlocked', async () => {
            const repo = new EngineTimerRepository();
            const timerId = id();
            const dueAt = Date.now() + 5000;

            const created = await repo.insert({id: timerId, type: 'start', payload: {foo: 'bar'}, dueAt, everyMs: null, remaining: null});

            assert.equal(created, true);
            const claimed = await claimOwn(repo, timerId, dueAt + 1, 'owner-a');
            assert.ok(claimed, 'the timer must be due and claimable at dueAt+1');
            assert.deepEqual(claimed.payload, {foo: 'bar'});
            assert.equal(claimed.attempts, 0);
        });

        it('returns false without creating a duplicate when the id already exists', async () => {
            const repo = new EngineTimerRepository();
            const timerId = id();
            const dueAt = Date.now() + 5000;

            const first = await repo.insert({id: timerId, type: 'start', payload: null, dueAt, everyMs: null, remaining: null});
            const second = await repo.insert({id: timerId, type: 'start', payload: null, dueAt, everyMs: null, remaining: null});

            assert.equal(first, true);
            assert.equal(second, false);
        });
    });

    describe('claimDue', () => {
        it('does not claim a timer whose due time is in the future', async () => {
            const repo = new EngineTimerRepository();
            const timerId = id();
            const dueAt = Date.now() + 60_000;
            await repo.insert({id: timerId, type: 'start', payload: null, dueAt, everyMs: null, remaining: null});

            const claimed = await claimOwn(repo, timerId, Date.now(), 'owner-a');

            assert.equal(claimed, null);
        });

        it('claims a due, unlocked timer and stamps lockedBy/lockedUntil', async () => {
            const repo = new EngineTimerRepository();
            const timerId = id();
            const dueAt = Date.now() - 1;
            await repo.insert({id: timerId, type: 'start', payload: null, dueAt, everyMs: null, remaining: null});
            const now = Date.now();

            const claimed = await claimOwn(repo, timerId, now, 'owner-a');

            assert.ok(claimed);
            assert.equal(claimed.lockedUntil, now + 30_000);
        });

        it('does not re-claim a timer whose lease has not yet expired', async () => {
            const repo = new EngineTimerRepository();
            const timerId = id();
            const dueAt = Date.now() - 1;
            await repo.insert({id: timerId, type: 'start', payload: null, dueAt, everyMs: null, remaining: null});
            const now = Date.now();
            await claimOwn(repo, timerId, now, 'owner-a');

            const secondClaim = await claimOwn(repo, timerId, now + 1, 'owner-b');

            assert.equal(secondClaim, null, 'a second instance must not win a still-live lease');
        });

        it('re-claims a timer once its lease has expired', async () => {
            const repo = new EngineTimerRepository();
            const timerId = id();
            const dueAt = Date.now() - 1;
            await repo.insert({id: timerId, type: 'start', payload: null, dueAt, everyMs: null, remaining: null});
            const now = Date.now();
            await claimOwn(repo, timerId, now, 'owner-a', /* leaseMs */ 10);

            const laterClaim = await claimOwn(repo, timerId, now + 50, 'owner-b');

            assert.ok(laterClaim, 'a crashed instance\'s expired lease must be taken over');
        });

        it('respects the limit', async () => {
            const repo = new EngineTimerRepository();
            const now = Date.now();
            const ids = [id(), id(), id()];
            for (const timerId of ids) {
                await repo.insert({id: timerId, type: 'start', payload: null, dueAt: now - 1, everyMs: null, remaining: null});
            }

            const claimed = await repo.claimDue(now, 'owner-a', 30_000, 2);
            const claimedOfOurs = claimed.filter((t) => ids.includes(t.id));

            assert.ok(claimedOfOurs.length <= 2);

            // clean up whichever of the 3 the limit left unclaimed, so it
            // doesn't sit there "due and unlocked" for every later test in
            // this file to contend with
            await Promise.all(ids.map((timerId) => repo.remove(timerId)));
        });
    });

    describe('settle', () => {
        it('deletes a one-shot timer (next=null) and runs the work callback', async () => {
            const repo = new EngineTimerRepository();
            const timerId = id();
            const now = Date.now();
            await repo.insert({id: timerId, type: 'catch', payload: null, dueAt: now - 1, everyMs: null, remaining: null});
            const claimed = await claimOwn(repo, timerId, now, 'owner-a');

            let workRan = false;
            const settled = await repo.settle(claimed, 'owner-a', null, async () => { workRan = true; });

            assert.equal(settled, true);
            assert.equal(workRan, true);
            const stillThere = await claimOwn(repo, timerId, now + 1, 'owner-b');
            assert.equal(stillThere, null, 'a settled one-shot timer must be gone');
        });

        it('reschedules a recurring timer (next != null) instead of deleting it', async () => {
            const repo = new EngineTimerRepository();
            const timerId = id();
            const now = Date.now();
            await repo.insert({id: timerId, type: 'start', payload: null, dueAt: now - 1, everyMs: 10_000, remaining: null});
            const claimed = await claimOwn(repo, timerId, now, 'owner-a');
            const nextDueAt = now + 10_000;

            const settled = await repo.settle(claimed, 'owner-a', {dueAt: nextDueAt, remaining: null}, async () => {});

            assert.equal(settled, true);
            const reclaimed = await claimOwn(repo, timerId, nextDueAt + 1, 'owner-b');
            assert.ok(reclaimed, 'the rescheduled timer must become due again at its new dueAt');
            assert.equal(reclaimed.attempts, 0, 'attempts resets on a successful fire');
        });

        it('returns false and skips the work callback when the lease was lost', async () => {
            const repo = new EngineTimerRepository();
            const timerId = id();
            const now = Date.now();
            await repo.insert({id: timerId, type: 'catch', payload: null, dueAt: now - 1, everyMs: null, remaining: null});
            const claimed = await claimOwn(repo, timerId, now, 'owner-a');

            let workRan = false;
            // simulate a stale claim object (as if another replica had already settled it)
            const staleView = {...claimed, lockedUntil: claimed.lockedUntil - 1};
            const settled = await repo.settle(staleView, 'owner-a', null, async () => { workRan = true; });

            assert.equal(settled, false);
            assert.equal(workRan, false);
        });
    });

    describe('fail', () => {
        it('clears the lease and sets a future retry time, keeping dueAt for the next attempt', async () => {
            const repo = new EngineTimerRepository();
            const timerId = id();
            const now = Date.now();
            await repo.insert({id: timerId, type: 'catch', payload: null, dueAt: now - 1, everyMs: null, remaining: null});
            const claimed = await claimOwn(repo, timerId, now, 'owner-a');
            const retryAt = now + 5000;

            const failed = await repo.fail(claimed, 'owner-a', {attempts: 1, error: 'boom', retryAt});

            assert.ok(failed, 'fail() must match the still-held lease');
            const notYetDue = await claimOwn(repo, timerId, now + 1, 'owner-b');
            assert.equal(notYetDue, null, 'must not be claimable before retryAt');
            const retried = await claimOwn(repo, timerId, retryAt + 1, 'owner-b');
            assert.ok(retried, 'must become claimable again once retryAt passes');
            assert.equal(retried.attempts, 1);
        });

        it('parks the timer (dueAt null) when retryAt is null', async () => {
            const repo = new EngineTimerRepository();
            const timerId = id();
            const now = Date.now();
            await repo.insert({id: timerId, type: 'catch', payload: null, dueAt: now - 1, everyMs: null, remaining: null});
            const claimed = await claimOwn(repo, timerId, now, 'owner-a');

            await repo.fail(claimed, 'owner-a', {attempts: 3, error: 'always fails', retryAt: null});

            const dueMuchLater = await claimOwn(repo, timerId, now + 1_000_000, 'owner-b');
            assert.equal(dueMuchLater, null, 'a parked timer must never become due again');
        });
    });

    describe('remove', () => {
        it('deletes a timer regardless of lock state', async () => {
            const repo = new EngineTimerRepository();
            const timerId = id();
            await repo.insert({id: timerId, type: 'start', payload: null, dueAt: Date.now() - 1, everyMs: null, remaining: null});

            await repo.remove(timerId);

            const claimed = await claimOwn(repo, timerId, Date.now() + 1, 'owner-a');
            assert.equal(claimed, null);
        });
    });
});
