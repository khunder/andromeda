import BaseRepository from "./baseRepository.js";

import {AndromedaLogger} from "../../../../config/andromeda-logger.js";
import {Config} from "../../../../config/config.js";
import EventStoreModel from "../internal/models/event-store.orm-model.js";
import FakeRepositoryBase from "../internal/fake.repository.base.js";

const Logger = new AndromedaLogger();

export class EventStoreRepository {

    /**
     * @type {BaseRepository}
     */
    repo;

    constructor() {
        if(Config.getInstance().isUnitTestMode){
            this.repo = new FakeRepositoryBase(EventStoreModel)
        }else {
            this.repo = new BaseRepository(EventStoreModel)
        }
    }

    /**
     *
     * @param {object} eventId
     * @returns {Promise<void>}
     */
    async persistEvent({id, streamId, streamPosition, type, timestamp, data, metadata}) {
        Logger.info(`create new event instance ${id}`);
        let event = {
            _id: id,
            streamId: streamId,
            streamPosition: streamPosition,
            type: type,
            timestamp: timestamp,
        }
        if (data) {
            event.data = data
        }
        if (metadata) {
            event.metadata = metadata
        }
        // await EventStoreModel.create(event)
        await this.repo.create(event)
    }

    /**
     * Events of a stream ordered by position, optionally starting after a snapshot.
     * @param {string} streamId
     * @param {number} fromPosition
     * @returns {Promise<object[]>}
     */
    async getEvents(streamId, fromPosition = 0) {
        return this.repo.find(
            {streamId, streamPosition: {$gte: fromPosition}},
            null,
            null,
            {streamPosition: 1}
        );
    }

    /**
     * Highest persisted position for a stream, -1 when the stream has no events
     * (so the next position is always max + 1).
     * @param {string} streamId
     * @returns {Promise<number>}
     */
    async getMaxStreamPosition(streamId) {
        const last = await this.repo.findOne({streamId}, null, {sort: {streamPosition: -1}});
        return last ? last.streamPosition : -1;
    }

}