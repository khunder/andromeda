import {AndromedaLogger} from "../../../../config/andromeda-logger.js";
import SnapshotModel from "../internal/models/snapshot.orm-model.js";
import {RepositoryFactory} from "./repository.factory.js";
import {TABLE_DEFINITIONS} from "../internal/sqlite/table-definitions.js";

const Logger = new AndromedaLogger();

export class SnapshotRepository {

    /**
     * @type {BaseRepository}
     */
    repo;

    constructor() {
        this.repo = RepositoryFactory.create(SnapshotModel, TABLE_DEFINITIONS.Snapshot);
    }

    /**
     *
     * @param {string} streamId
     * @param {number} streamPosition
     * @param {object} state
     * @returns {Promise<void>}
     */
    async saveSnapshot(streamId, streamPosition, state) {
        Logger.info(`saving snapshot for stream ${streamId} at position ${streamPosition}`);
        await this.repo.upsert(
            {streamId, streamPosition},
            {streamId, streamPosition, state, timestamp: new Date()}
        )
    }

    /**
     *
     * @param {string} streamId
     * @returns {Promise<object|null>} the most recent snapshot, or null when none exists
     */
    async getLatestSnapshot(streamId) {
        return this.repo.findOne({streamId}, null, {sort: {streamPosition: -1}})
    }

}
