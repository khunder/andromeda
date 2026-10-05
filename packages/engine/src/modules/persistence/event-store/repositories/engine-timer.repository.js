import EngineTimerModel from "../internal/models/engine-timer.orm-model.js";
import {RepositoryFactory} from "./repository.factory.js";
import {TABLE_DEFINITIONS} from "../internal/sqlite/table-definitions.js";

/**
 * Implements durable-timers.js's six-method Store contract (init/insert/
 * remove/claimDue/settle/fail - see that file's own doc comment) on top of
 * this codebase's existing dual-driver repository (RepositoryFactory ->
 * BaseRepository for MongoDB, SqliteRepositoryBase for sqlite), the same way
 * every other *Repository class in this directory does - rather than
 * vendoring durable-timers.js's own raw-SQL/Mongo-session Store
 * implementations, which would need a second, parallel way of talking to
 * either database.
 *
 * This backs BOTH the old TimerTick (Timer Start Event dedup) and TimerJob
 * (Timer Intermediate Catch Event resume queue) mechanisms at once:
 * durable-timers.js's own lease-based claimDue()/pollMs loop already is the
 * cross-replica dedup *and* the crash-recovery sweep (a claimed row's lease
 * simply expires and the next poll re-claims it) - no separate TimerTick
 * table, and no separate rescan-waiting-jobs/release-stale-jobs system jobs,
 * are needed any more.
 *
 * Honesty about atomicity: durable-timers.js's `settle(timer, owner, next,
 * work)` is documented to run `work` inside the same transaction that
 * commits the timer's own row update, so a handler's writes and the timer
 * update either both land or both roll back. This codebase has no
 * multi-document transaction primitive on either driver (Mongoose here
 * isn't configured against a replica set/session; sql.js has no concurrent
 * writers to protect against in the first place), so `work` below just runs
 * after the claim update succeeds, same as every other two-phase node
 * resume in this codebase (e.g. FlowEventRepository.closeFlowEventIfActive
 * followed by PersistenceGateway.closeTask and the node's own EventStore
 * writes, as separate steps). The atomic *lease* claim - the actual
 * exactly-once guarantee - is real on both drivers; only "all-or-nothing
 * alongside the handler's own writes" is not.
 */
export class EngineTimerRepository {

    /**
     * @type {BaseRepository}
     */
    repo;

    constructor() {
        this.repo = RepositoryFactory.create(EngineTimerModel, TABLE_DEFINITIONS.EngineTimer);
    }

    static isDuplicateKeyError(e) {
        if (!e) {
            return false;
        }
        if (e.code === 11000) { // MongoDB duplicate key error
            return true;
        }
        // sql.js (SQLite) raises a plain Error with this message on a PRIMARY KEY/UNIQUE violation
        return typeof e.message === 'string' && /UNIQUE constraint failed/i.test(e.message);
    }

    // table/collection creation already happens at persistence-module
    // startup (SqliteConnection.createTables() walks every TABLE_DEFINITIONS
    // entry; mongoose builds EngineTimerModel's indexes in the background
    // the same way every other model's are) - nothing left to do here.
    async init() {
    }

    /**
     * @param {{id:string, type:string, payload:*, dueAt:number|null, everyMs:number|null, remaining:number|null}} timer
     * @returns {Promise<boolean>} false if a timer with this id already exists
     */
    async insert(timer) {
        try {
            await this.repo.create({
                _id: timer.id,
                type: timer.type,
                payload: timer.payload ?? null,
                dueAt: timer.dueAt == null ? null : new Date(timer.dueAt),
                everyMs: timer.everyMs,
                remaining: timer.remaining,
                attempts: 0,
                lockedBy: null,
                lockedUntil: null,
                lastError: null,
            });
            return true;
        } catch (e) {
            if (EngineTimerRepository.isDuplicateKeyError(e)) {
                return false;
            }
            throw e;
        }
    }

    /**
     * @param {string} id
     */
    async remove(id) {
        return this.repo.delete(id);
    }

    /**
     * @param {number} now - epoch ms
     * @param {string} owner - this TimerService instance's id
     * @param {number} leaseMs
     * @param {number} limit
     * @returns {Promise<object[]>}
     */
    async claimDue(now, owner, leaseMs, limit) {
        const dueRows = await this.repo.find({dueAt: {$lte: new Date(now)}}, null, null, {dueAt: 1});
        const claimed = [];
        for (const row of dueRows) {
            if (claimed.length >= limit) {
                break;
            }
            const lockedUntilMs = row.lockedUntil == null ? null : new Date(row.lockedUntil).getTime();
            if (lockedUntilMs !== null && lockedUntilMs >= now) {
                continue; // still leased by someone else
            }
            const newLockedUntil = now + leaseMs;
            // compare-and-swap against the exact dueAt/lockedUntil just read:
            // whichever caller's update actually matches wins the claim -
            // the same single-document conditional-update idiom
            // FlowEventRepository.closeFlowEventIfActive() uses, just keyed
            // on this row's own previous values instead of a fixed status.
            const result = await this.repo.update(
                {_id: row._id, dueAt: row.dueAt, lockedUntil: row.lockedUntil},
                {lockedBy: owner, lockedUntil: new Date(newLockedUntil)},
            );
            if (!result) {
                continue;
            }
            claimed.push({
                id: row._id,
                type: row.type,
                payload: row.payload ?? null,
                dueAt: +new Date(row.dueAt),
                everyMs: row.everyMs == null ? null : Number(row.everyMs),
                remaining: row.remaining == null ? null : Number(row.remaining),
                attempts: Number(row.attempts) || 0,
                lockedUntil: newLockedUntil,
            });
        }
        return claimed;
    }

    /**
     * @param {object} timer - a row claimed by claimDue()
     * @param {string} owner
     * @param {{dueAt:number, remaining:number|null}|null} next - null deletes the row
     * @param {(tx:null) => Promise<void>} work
     * @returns {Promise<boolean>} false if the lease was lost before this call
     */
    async settle(timer, owner, next, work) {
        const lease = {_id: timer.id, lockedBy: owner, lockedUntil: timer.lockedUntil == null ? null : new Date(timer.lockedUntil)};
        let claimedSettle;
        if (next) {
            claimedSettle = await this.repo.update(lease, {
                dueAt: new Date(next.dueAt),
                remaining: next.remaining,
                attempts: 0,
                lockedBy: null,
                lockedUntil: null,
                lastError: null,
            });
        } else {
            // no atomic conditional delete is exposed by the shared repo
            // surface, so the delete is split into an atomic claim (the real
            // gate - only the caller whose update matches `lease` can reach
            // the unconditional delete() below) followed by the delete
            // itself. A crash in between leaves the row claimed-but-not-yet-
            // deleted under this (by-then-finished) owner, to be found and
            // retried once its lease lapses - the same accepted window the
            // old TimerJobRepository.releaseStale() existed to cover.
            claimedSettle = await this.repo.update(lease, {lockedBy: `${owner}:done`});
            if (claimedSettle) {
                await this.repo.delete(timer.id);
            }
        }
        if (!claimedSettle) {
            return false;
        }
        await work(null);
        return true;
    }

    /**
     * @param {object} timer
     * @param {string} owner
     * @param {{attempts:number, error:string, retryAt:number|null}} outcome
     */
    async fail(timer, owner, {attempts, error, retryAt}) {
        const lease = {_id: timer.id, lockedBy: owner, lockedUntil: timer.lockedUntil == null ? null : new Date(timer.lockedUntil)};
        return this.repo.update(lease, {
            attempts,
            lastError: error,
            lockedBy: null,
            // locked_until doubles as "retry not before" while a failure's
            // backoff is pending - see durable-timers.js's _fire()/SqlStore.fail()
            lockedUntil: retryAt === null ? null : new Date(retryAt),
            dueAt: retryAt === null ? null : new Date(timer.dueAt),
        });
    }
}

export default EngineTimerRepository;
