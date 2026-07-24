import {AndromedaLogger} from "../../../../config/andromeda-logger.js";
import TimerJobModel from "../internal/models/timer-job.orm-model.js";
import {RepositoryFactory} from "./repository.factory.js";
import {TABLE_DEFINITIONS} from "../internal/sqlite/table-definitions.js";

const Logger = new AndromedaLogger();

const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * Backs TimerService's timer-catch-event resume dispatcher (see
 * timer.service.js.njk): every container replica running the same
 * deployment polls this collection for due jobs, and the conditional
 * `state: 'waiting'` filter inside claimDue()'s update - the same
 * findOneAndUpdate-as-atomic-claim primitive FlowEventRepository uses for
 * closeFlowEventIfActive() - guarantees only one replica's poll can ever
 * claim a given job. A plain, non-event-sourced collection - same reasoning
 * as TimerTick.
 */
export class TimerJobRepository {

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
     * Atomically claims up to `limit` due jobs (state 'waiting', availableAt
     * in the past), one conditional update at a time - each individual
     * update can only ever match a still-waiting document, so two replicas
     * racing the same job can never both claim it.
     * @param {number} limit
     * @returns {Promise<object[]>}
     */
    async claimDue(limit) {
        const now = new Date();
        const claimed = [];
        for (let i = 0; i < limit; i++) {
            const job = await this.repo.update(
                {state: 'waiting', availableAt: {$lte: now}},
                {state: 'claimed', claimedAt: now, claimedBy: `andromeda@${process.pid}`},
            );
            if (!job) {
                break;
            }
            claimed.push(job);
        }
        return claimed;
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
