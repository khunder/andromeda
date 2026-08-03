import assert from "assert";
import {v4} from "uuid";
import {TimerJobRepository} from "./timer-job.repository.js";

// Unit coverage for TimerJobRepository, the collection backing
// TimerService's timer-catch-event resume dispatcher AND (since the
// rescan-waiting-jobs / release-stale-jobs sweeps were converted from local
// per-replica cron.schedule() loops to self-rescheduling entries in this
// same queue) its two recurring "system" sweeps - see timer.service.js.njk
// for how TimerService.scheduleJob()/claimAndRun()/ensureSystemJobScheduled()
// drive this repository, and this class's own doc comment for why a single
// conditional update (claimById()) is the entire cross-replica safety
// mechanism.
//
// Deliberately runs against this suite's default sqlite driver (see
// test/setup.js), not unit-test/fake mode: the fake in-memory repository
// (RepositoryFactory's isUnitTestMode branch) doesn't implement the same
// find/update query semantics (e.g. the {$lte: cutoff} condition
// releaseStale() relies on), so it would silently pass tests that a real
// backend's query translation could still get wrong. Every test below uses
// a fresh v4()-suffixed processInstanceId/nodeId/processDef so tests can run
// in any order against the one sqlite file this test *file* gets (per
// test/setup.js) without clearing the table or interfering with each other.
//
// Important honesty about what this file can and can't prove: sql.js runs
// in-process with no genuine concurrency, so "only one caller can ever win a
// claim" can't be reproduced here as an actual race the way it would need to
// be to catch a regression under real parallel replicas - that guarantee
// ultimately comes from claimById()'s conditional update being atomic at the
// database layer (MongoDB's findOneAndUpdate, or sqlite's single-threaded
// JS), not from anything this test constructs. What *is* meaningfully
// tested here is the query logic itself: that the condition on `state:
// 'waiting'` is actually present and actually excludes an already-claimed
// row, so a second sequential claimById() call on the same id correctly
// comes back null instead of re-claiming it. A future change that loosened
// or dropped that condition would slip past a test that only checked the
// first, successful claim - this suite checks the second, failing one too.
describe('TimerJobRepository', function () {

    function ids() {
        const suffix = v4();
        return {
            processInstanceId: `pi_${suffix}`,
            nodeId: `node_${suffix}`,
            processDef: `proc_${suffix}`,
        };
    }

    // releaseStale() needs a job that's been 'claimed' for longer than its
    // cutoff, which claimById() (claimedAt: new Date()) can't produce
    // deterministically without an actual sleep. TimerJobRepository.repo is
    // a public field precisely so callers like TimerService can compose it
    // with PersistenceGateway's other repositories; reaching into it here to
    // insert a row already in the 'claimed' state, with an arbitrary
    // claimedAt in the past, gets the same determinism other repositories'
    // tests get from fixed inputs, without a real timer.
    async function createClaimedJob(repo, {claimedAt, ...fields}) {
        return repo.repo.create({
            ...fields,
            state: 'claimed',
            attempt: 0,
            maxAttempts: 5,
            availableAt: new Date(),
            claimedAt,
            claimedBy: 'andromeda@test',
        });
    }

    describe('enqueue', () => {
        it('creates a new job in the waiting state, at attempt 0, with the default max attempts', async () => {
            const repo = new TimerJobRepository();
            const {processInstanceId, nodeId, processDef} = ids();
            const availableAt = new Date(Date.now() + 5000);

            const job = await repo.enqueue({processInstanceId, nodeId, processDef, availableAt});

            assert.equal(job.processInstanceId, processInstanceId);
            assert.equal(job.nodeId, nodeId);
            assert.equal(job.processDef, processDef);
            assert.equal(job.state, 'waiting');
            assert.equal(job.attempt, 0);
            assert.equal(job.maxAttempts, 5); // mirrors DEFAULT_MAX_ATTEMPTS
            assert.equal(new Date(job.availableAt).getTime(), availableAt.getTime());
            assert.ok(job._id, 'enqueue() must hand back the persisted row, including its generated _id');
        });
    });

    describe('findWaiting', () => {
        it('returns only jobs currently in the waiting state', async () => {
            const repo = new TimerJobRepository();
            const waitingIds = ids();
            const claimedIds = ids();
            const now = new Date();

            const waitingJob = await repo.enqueue({...waitingIds, availableAt: now});
            const claimedJob = await repo.enqueue({...claimedIds, availableAt: now});
            await repo.claimById(claimedJob._id);

            const found = await repo.findWaiting();
            const foundIds = found.map((job) => job._id);

            assert.ok(foundIds.includes(waitingJob._id), 'the still-waiting job must be included');
            assert.ok(!foundIds.includes(claimedJob._id), 'the claimed job must not be included');
        });
    });

    describe('claimById', () => {
        it('moves a waiting job to claimed and stamps claimedAt/claimedBy', async () => {
            const repo = new TimerJobRepository();
            const {processInstanceId, nodeId, processDef} = ids();
            const job = await repo.enqueue({processInstanceId, nodeId, processDef, availableAt: new Date()});

            const claimed = await repo.claimById(job._id);

            assert.ok(claimed, 'claiming a still-waiting job must succeed');
            assert.equal(claimed.state, 'claimed');
            assert.equal(claimed.claimedBy, `andromeda@${process.pid}`);
            assert.ok(claimed.claimedAt, 'claimedAt must be stamped');
        });

        it('returns null for a job id that does not exist', async () => {
            const repo = new TimerJobRepository();

            const claimed = await repo.claimById(`does-not-exist-${v4()}`);

            assert.equal(claimed, null);
        });

        // The actual exactly-once guarantee TimerService relies on: whatever
        // wins the first claimById() call flips state away from 'waiting',
        // so a second call against the same id - representing another
        // replica's node-cron task firing for the same job, or this
        // process's own rescan racing its per-job schedule - must find
        // nothing left to claim.
        it('returns null on a second claim attempt against an already-claimed job', async () => {
            const repo = new TimerJobRepository();
            const {processInstanceId, nodeId, processDef} = ids();
            const job = await repo.enqueue({processInstanceId, nodeId, processDef, availableAt: new Date()});

            const firstClaim = await repo.claimById(job._id);
            const secondClaim = await repo.claimById(job._id);

            assert.ok(firstClaim, 'the first claim must win');
            assert.equal(secondClaim, null, 'a second claim against the same job must lose');
        });
    });

    describe('complete', () => {
        it('marks a claimed job completed', async () => {
            const repo = new TimerJobRepository();
            const {processInstanceId, nodeId, processDef} = ids();
            const job = await repo.enqueue({processInstanceId, nodeId, processDef, availableAt: new Date()});
            await repo.claimById(job._id);

            const completed = await repo.complete(job._id);

            assert.equal(completed.state, 'completed');
        });
    });

    describe('retryOrFail', () => {
        it('requeues to waiting, with the attempt incremented and availableAt pushed into the future, when attempts remain', async () => {
            const repo = new TimerJobRepository();
            const {processInstanceId, nodeId, processDef} = ids();
            const job = await repo.enqueue({processInstanceId, nodeId, processDef, availableAt: new Date()});
            await repo.claimById(job._id);
            const beforeRetry = Date.now();

            const retried = await repo.retryOrFail(job._id, /* attempt */ 0, /* maxAttempts */ 5, new Error('boom'));

            assert.equal(retried.state, 'waiting');
            assert.equal(retried.attempt, 1);
            assert.equal(retried.lastError, 'boom');
            assert.equal(retried.claimedAt, null);
            assert.equal(retried.claimedBy, null);
            assert.ok(
                new Date(retried.availableAt).getTime() > beforeRetry,
                'a retried job must become due again strictly in the future (backoff), not immediately',
            );
        });

        it('marks the job permanently failed once the attempt that just failed reaches maxAttempts', async () => {
            const repo = new TimerJobRepository();
            const {processInstanceId, nodeId, processDef} = ids();
            const job = await repo.enqueue({processInstanceId, nodeId, processDef, availableAt: new Date()});
            await repo.claimById(job._id);

            // attempt 4 failing against maxAttempts 5 means this was the 5th
            // and last allowed try (nextAttempt = 5 >= maxAttempts)
            const failed = await repo.retryOrFail(job._id, /* attempt */ 4, /* maxAttempts */ 5, new Error('boom'));

            assert.equal(failed.state, 'failed');
            assert.equal(failed.attempt, 5);
            assert.equal(failed.lastError, 'boom');

            // a permanently-failed job must never resurface via the
            // waiting-jobs backstop sweep
            const waiting = await repo.findWaiting();
            assert.ok(!waiting.some((j) => j._id === job._id), 'a failed job must not appear in findWaiting()');
        });

        it('accepts a plain string error in addition to an Error instance', async () => {
            const repo = new TimerJobRepository();
            const {processInstanceId, nodeId, processDef} = ids();
            const job = await repo.enqueue({processInstanceId, nodeId, processDef, availableAt: new Date()});
            await repo.claimById(job._id);

            const retried = await repo.retryOrFail(job._id, 0, 5, 'plain string failure');

            assert.equal(retried.lastError, 'plain string failure');
        });
    });

    describe('releaseStale', () => {
        it('releases a job claimed longer ago than maxClaimedMs back to waiting, clearing its claim', async () => {
            const repo = new TimerJobRepository();
            const {processInstanceId, nodeId, processDef} = ids();
            const longAgo = new Date(Date.now() - 120_000); // 2 minutes ago
            const job = await createClaimedJob(repo, {processInstanceId, nodeId, processDef, claimedAt: longAgo});

            const released = await repo.releaseStale(/* maxClaimedMs */ 60_000);

            assert.equal(released, 1);
            const waiting = await repo.findWaiting();
            const releasedJob = waiting.find((j) => j._id === job._id);
            assert.ok(releasedJob, 'the stale job must now be waiting again');
            assert.equal(releasedJob.claimedAt, null);
            assert.equal(releasedJob.claimedBy, null);
        });

        // The flip side of the property above, and equally important per
        // this method's own doc comment: a claim that's still well within
        // its allowed window is a legitimately in-flight resume, not a
        // crashed replica's abandoned one - releasing it too would let a
        // second replica start running the very same job concurrently.
        it('does not release a job claimed more recently than maxClaimedMs', async () => {
            const repo = new TimerJobRepository();
            const {processInstanceId, nodeId, processDef} = ids();
            const justNow = new Date();
            const job = await createClaimedJob(repo, {processInstanceId, nodeId, processDef, claimedAt: justNow});

            const released = await repo.releaseStale(/* maxClaimedMs */ 60_000);

            const waiting = await repo.findWaiting();
            assert.ok(!waiting.some((j) => j._id === job._id), 'a fresh claim must not be released');
            // other tests' stale jobs may coexist in this shared per-file
            // sqlite table, so this only asserts the fresh claim specifically
            // survived, not that `released` is exactly 0 across the whole file
            void released;
        });

        it('returns the count of jobs actually released, across multiple stale jobs', async () => {
            const repo = new TimerJobRepository();
            const longAgo = new Date(Date.now() - 120_000);
            const jobA = await createClaimedJob(repo, {...ids(), claimedAt: longAgo});
            const jobB = await createClaimedJob(repo, {...ids(), claimedAt: longAgo});

            const released = await repo.releaseStale(60_000);

            assert.ok(released >= 2, `expected at least the 2 freshly-created stale jobs to be released, got ${released}`);
            const waiting = await repo.findWaiting();
            const waitingIds = waiting.map((j) => j._id);
            assert.ok(waitingIds.includes(jobA._id));
            assert.ok(waitingIds.includes(jobB._id));
        });

        // releaseStale() has no processDef/nodeId filter - it sweeps every
        // 'claimed' row in the table regardless of kind. That's exactly what
        // lets it double as the recovery net for a stalled *system* sweep
        // occurrence (rescan-waiting-jobs / release-stale-jobs itself), not
        // just ordinary catch-resume jobs - see runSystemJob()'s doc comment
        // in timer.service.js.njk for why that matters: a system job that
        // throws is deliberately left 'claimed' with no dedicated retry
        // path, relying on this same sweep to eventually unstick it.
        it('also releases a stale claimed system-sweep job, the same as an ordinary one', async () => {
            const repo = new TimerJobRepository();
            const nodeId = `rescan-waiting-jobs_${v4()}`;
            const job = await createClaimedJob(repo, {
                processInstanceId: '__system__',
                processDef: '__system__',
                nodeId,
                claimedAt: new Date(Date.now() - 120_000),
            });

            await repo.releaseStale(60_000);

            const pending = await repo.findPendingSystem(nodeId);
            assert.ok(pending, 'the released system job must be findable again');
            assert.equal(pending._id, job._id);
            assert.equal(pending.state, 'waiting');
        });
    });

    describe('enqueueSystem / findPendingSystem', () => {
        it('enqueues a system job under the sentinel processInstanceId/processDef', async () => {
            const repo = new TimerJobRepository();
            const nodeId = `rescan-waiting-jobs_${v4()}`;
            const availableAt = new Date();

            const job = await repo.enqueueSystem({nodeId, availableAt});

            assert.equal(job.nodeId, nodeId);
            assert.equal(job.processDef, TimerJobRepository.SYSTEM_JOB_PROCESS_DEF);
            assert.equal(job.state, 'waiting');
        });

        it('finds a waiting system job by nodeId', async () => {
            const repo = new TimerJobRepository();
            const nodeId = `release-stale-jobs_${v4()}`;
            const job = await repo.enqueueSystem({nodeId, availableAt: new Date()});

            const pending = await repo.findPendingSystem(nodeId);

            assert.ok(pending);
            assert.equal(pending._id, job._id);
        });

        it('falls back to a claimed occurrence when none is waiting', async () => {
            const repo = new TimerJobRepository();
            const nodeId = `rescan-waiting-jobs_${v4()}`;
            const job = await repo.enqueueSystem({nodeId, availableAt: new Date()});
            await repo.claimById(job._id);

            const pending = await repo.findPendingSystem(nodeId);

            assert.ok(pending, 'a claimed-but-not-yet-completed occurrence still counts as pending');
            assert.equal(pending._id, job._id);
            assert.equal(pending.state, 'claimed');
        });

        it('returns null once the only occurrence has completed - the seed-a-new-chain signal', async () => {
            const repo = new TimerJobRepository();
            const nodeId = `rescan-waiting-jobs_${v4()}`;
            const job = await repo.enqueueSystem({nodeId, availableAt: new Date()});
            await repo.claimById(job._id);
            await repo.complete(job._id);

            const pending = await repo.findPendingSystem(nodeId);

            assert.equal(
                pending,
                null,
                'ensureSystemJobScheduled() reads this as "no chain exists yet" and would seed a fresh one',
            );
        });

        it('keeps the rescan and stale-release chains (and any other nodeId) fully isolated from each other', async () => {
            const repo = new TimerJobRepository();
            const rescanNodeId = `rescan-waiting-jobs_${v4()}`;
            const staleReleaseNodeId = `release-stale-jobs_${v4()}`;
            const rescanJob = await repo.enqueueSystem({nodeId: rescanNodeId, availableAt: new Date()});

            const pendingForStaleRelease = await repo.findPendingSystem(staleReleaseNodeId);
            const pendingForRescan = await repo.findPendingSystem(rescanNodeId);

            assert.equal(pendingForStaleRelease, null, 'a different sweep\'s nodeId must not see this one\'s job');
            assert.equal(pendingForRescan._id, rescanJob._id);
        });
    });
});
