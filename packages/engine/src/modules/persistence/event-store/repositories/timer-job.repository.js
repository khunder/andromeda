import {AndromedaLogger} from "../../../../config/andromeda-logger.js";
import TimerJobModel from "../internal/models/timer-job.orm-model.js";
import {RepositoryFactory} from "./repository.factory.js";
import {TABLE_DEFINITIONS} from "../internal/sqlite/table-definitions.js";

const Logger = new AndromedaLogger();

const DEFAULT_MAX_ATTEMPTS = 5;

// sentinel processInstanceId/processDef for recurring "system" sweep jobs
// (rescan-waiting-jobs / release-stale-jobs, see timer.service.js.njk's
// ensureSystemJobScheduled/runSystemJob) that ride this same queue instead
// of a per-replica local cron - a real BPMN processDef can never collide
// with this value.
const SYSTEM_JOB_PROCESS_DEF = '__system__';
const SYSTEM_JOB_INSTANCE_ID = '__system__';

/**
 * Backs TimerService's timer-catch-event resume dispatcher (see
 * timer.service.js.njk): each job is scheduled precisely for its own due
 * time (node-cron, not a per-second sweep) the moment it becomes known to a
 * given container replica, and findWaiting() only backs the low-frequency
 * discovery sweep for jobs a *different* replica created. The actual claim
 * (claimById()) is the same findOneAndUpdate-as-atomic-claim primitive
 * FlowEventRepository uses for closeFlowEventIfActive() - conditioning the
 * update on `state: 'waiting'` guarantees only one replica's attempt can
 * ever claim a given job, however many of them fire their own schedule for
 * it at roughly the same moment. A plain, non-event-sourced collection -
 * same reasoning as TimerTick.
 */
export class TimerJobRepository {

    static SYSTEM_JOB_PROCESS_DEF = SYSTEM_JOB_PROCESS_DEF;

    /**
     * @type {BaseRepository}
     */
    repo;

    constructor() {
        this.repo = RepositoryFactory.create(TimerJobModel, TABLE_DEFINITIONS.TimerJob);
    }

    /**
     * @param {string} processInstanceId
     * @param {string} nodeId
     * @param {string} processDef
     * @param {Date} availableAt
     * @returns {Promise<object>}
     */
    async enqueue({processInstanceId, nodeId, processDef, availableAt}) {
        return this.repo.create({
            processInstanceId,
            nodeId,
            processDef,
            state: 'waiting',
            attempt: 0,
            maxAttempts: DEFAULT_MAX_ATTEMPTS,
            availableAt,
        });
    }

    /**
     * Enqueues one occurrence of a recurring system sweep (rescan-waiting-
     * jobs / release-stale-jobs) under the sentinel processInstanceId/
     * processDef, so it rides this same claim-based queue instead of a local
     * per-replica cron - see TimerService.ensureSystemJobScheduled().
     * @param {string} nodeId - which sweep (e.g. RESCAN_JOB_NODE_ID)
     * @param {Date} availableAt
     * @returns {Promise<object>}
     */
    async enqueueSystem({nodeId, availableAt}) {
        return this.enqueue({
            processInstanceId: SYSTEM_JOB_INSTANCE_ID,
            nodeId,
            processDef: SYSTEM_JOB_PROCESS_DEF,
            availableAt,
        });
    }

    /**
     * The currently pending (waiting or claimed) occurrence of a given
     * recurring system sweep, if this deployment already has one - lets a
     * newly-starting replica rejoin an already-seeded chain instead of
     * seeding a duplicate one alongside it.
     * @param {string} nodeId
     * @returns {Promise<object|null>}
     */
    async findPendingSystem(nodeId) {
        const [waiting] = await this.repo.find({processDef: SYSTEM_JOB_PROCESS_DEF, nodeId, state: 'waiting'});
        if (waiting) {
            return waiting;
        }
        const [claimed] = await this.repo.find({processDef: SYSTEM_JOB_PROCESS_DEF, nodeId, state: 'claimed'});
        return claimed || null;
    }

    /**
     * Every currently 'waiting' job, regardless of whether it's due yet -
     * used only by TimerService's low-frequency backstop sweep to notice
     * jobs this process hasn't already scheduled a precise node-cron task
     * for (created by another replica, or just released by releaseStale()).
     * Read-only: scheduling isn't claiming, so this alone can never cause a
     * duplicate resume.
     * @returns {Promise<object[]>}
     */
    async findWaiting() {
        return this.repo.find({state: 'waiting'});
    }

    /**
     * Atomically claims one specific job, conditioned on it still being
     * 'waiting' - the real claim primitive. Safe to call from as many
     * replicas, at as close to the same instant, as end up with their own
     * node-cron task firing for this same job id: only one's update can
     * ever match.
     * @param {string} id
     * @returns {Promise<object|null>} the claimed job, or null if it was no
     *   longer waiting (already claimed by another replica, or finished)
     */
    async claimById(id) {
        return this.repo.update(
            {_id: id, state: 'waiting'},
            {state: 'claimed', claimedAt: new Date(), claimedBy: `andromeda@${process.pid}`},
        );
    }

    /**
     * @param {string} id
     * @returns {Promise<object|null>}
     */
    async complete(id) {
        return this.repo.update({_id: id}, {state: 'completed'});
    }

    /**
     * Requeues a claimed job for another attempt (exponential backoff with
     * jitter), or marks it permanently failed once maxAttempts is reached.
     * @param {string} id
     * @param {number} attempt - the attempt number that just failed
     * @param {number} maxAttempts
     * @param {Error|string} error
     * @returns {Promise<object|null>}
     */
    async retryOrFail(id, attempt, maxAttempts, error) {
        const nextAttempt = attempt + 1;
        const message = error instanceof Error ? error.message : String(error);
        if (nextAttempt >= maxAttempts) {
            Logger.error(`timer job ${id} failed permanently after ${nextAttempt} attempt(s): ${message}`);
            return this.repo.update({_id: id}, {state: 'failed', attempt: nextAttempt, lastError: message});
        }
        const jitter = Math.random() + 0.5;
        const delay = Math.round(Math.min(1000 * Math.pow(2, attempt) * jitter, 3_600_000));
        Logger.info(`timer job ${id} retrying (attempt ${nextAttempt}/${maxAttempts}) in ${delay}ms: ${message}`);
        return this.repo.update({_id: id}, {
            state: 'waiting',
            attempt: nextAttempt,
            availableAt: new Date(Date.now() + delay),
            claimedAt: null,
            claimedBy: null,
            lastError: message,
        });
    }

    /**
     * Safety net for a replica that crashes (or is killed) after claiming a
     * job but before completing it: releases any job still 'claimed' after
     * `maxClaimedMs` back to 'waiting' so another replica can pick it up.
     * @param {number} maxClaimedMs
     * @returns {Promise<number>} number of jobs released
     */
    async releaseStale(maxClaimedMs) {
        const cutoff = new Date(Date.now() - maxClaimedMs);
        const stale = await this.repo.find({state: 'claimed', claimedAt: {$lte: cutoff}});
        let released = 0;
        for (const job of stale) {
            const result = await this.repo.update(
                {_id: job._id, state: 'claimed'},
                {state: 'waiting', claimedAt: null, claimedBy: null},
            );
            if (result) {
                released++;
            }
        }
        return released;
    }
}

export default TimerJobRepository;
