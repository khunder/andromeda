import {AndromedaLogger} from "../../../../config/andromeda-logger.js";
import TimerTickModel from "../internal/models/timer-tick.orm-model.js";
import {RepositoryFactory} from "./repository.factory.js";
import {TABLE_DEFINITIONS} from "../internal/sqlite/table-definitions.js";

const Logger = new AndromedaLogger();

/**
 * Backs the timer-start-event HA dedupe mechanism: every container replica
 * running the same deployment races to claim the same cron fire, and the
 * unique index on (deploymentId, processDef, nodeId, tickKey) guarantees only
 * one of them wins. This is a plain, non-event-sourced collection - a tick
 * claim isn't domain state that needs replay/audit, it's a throwaway
 * idempotency marker, so it bypasses PersistenceGateway's usual
 * EventStore.apply() write path (same reasoning as Task's read-only lookups,
 * just applied to the write side here).
 */
export class TimerTickRepository {

    /**
     * @type {BaseRepository}
     */
    repo;

    constructor() {
        this.repo = RepositoryFactory.create(TimerTickModel, TABLE_DEFINITIONS.TimerTick);
    }

    /**
     * @param {string} deploymentId
     * @param {string} processDef
     * @param {string} nodeId
     * @param {string} tickKey
     * @returns {Promise<boolean>} true if this call won the claim, false if
     *   another container replica already claimed this tick first
     */
    async claimTick(deploymentId, processDef, nodeId, tickKey) {
        try {
            await this.repo.create({deploymentId, processDef, nodeId, tickKey});
            return true;
        } catch (e) {
            if (TimerTickRepository.isDuplicateKeyError(e)) {
                Logger.trace(`timer tick ${tickKey} for node ${nodeId} already claimed by another container instance`);
                return false;
            }
            throw e;
        }
    }

    static isDuplicateKeyError(e) {
        if (!e) {
            return false;
        }
        // MongoDB duplicate key error
        if (e.code === 11000) {
            return true;
        }
        // sql.js (SQLite) raises a plain Error with this message on a UNIQUE violation
        return typeof e.message === 'string' && /UNIQUE constraint failed/i.test(e.message);
    }

}

export default TimerTickRepository;
