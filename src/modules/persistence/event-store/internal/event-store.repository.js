import BaseRepository from "../../baseRepository.js";

import {AndromedaLogger} from "../../../../config/andromeda-logger.js";
import EventStoreModel from "../../models/event-store.orm-model.js";
import FakeRepositoryBase from "../../fake.repository.base.js";
import {Config} from "../../../../config/config.js";

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
     * @param {string} eventId
     * @param {string} processDef
     * @param {string} deploymentId
     * @param {string} containerId
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


}