import {EventStore} from "./event-store.js";
import {EventStoreRepository} from "../repositories/event-store.repository.js";
import {SnapshotRepository} from "../repositories/snapshot.repository.js";
import {AndromedaLogger} from "../../../../config/andromeda-logger.js";

const Logger = new AndromedaLogger();

export class ReplayService {

    /**
     * Seed the in-memory position counters from the persisted log so a restarted
     * engine continues numbering where the previous run stopped, instead of
     * restarting at 0 and colliding with the unique (streamId, streamPosition)
     * index.
     * @returns {Promise<void>}
     */
    static async seedStreamPositions() {
        const repo = new EventStoreRepository();
        for (const stream of Object.values(EventStore.streamsRegistry)) {
            const maxPosition = await repo.getMaxStreamPosition(stream.streamId);
            stream.streamPosition = maxPosition + 1;
            Logger.debug(`stream ${stream.streamId} position seeded to ${stream.streamPosition}`);
        }
    }

    /**
     * Rebuild a stream's read model from the event log: restore the latest
     * snapshot (or reset the read model when none exists), then re-dispatch every
     * event recorded after it. Events are only projected, never re-persisted.
     * @param {string} streamId
     * @returns {Promise<number>} number of events replayed
     */
    static async replayStream(streamId) {
        const stream = EventStore.getStream(streamId);
        if (!stream) {
            throw new Error(`cannot replay unknown stream ${streamId}`);
        }
        if (!stream.snapshotHandler) {
            throw new Error(`stream ${streamId} has no snapshot handler, cannot restore or reset its read model`);
        }

        const snapshot = await new SnapshotRepository().getLatestSnapshot(streamId);
        let fromPosition = 0;
        if (snapshot) {
            Logger.info(`replay ${streamId}: restoring snapshot at position ${snapshot.streamPosition}`);
            await stream.snapshotHandler.restoreState(snapshot.state);
            fromPosition = snapshot.streamPosition + 1;
        } else {
            Logger.info(`replay ${streamId}: no snapshot found, rebuilding from position 0`);
            await stream.snapshotHandler.reset();
        }

        const events = await new EventStoreRepository().getEvents(streamId, fromPosition);
        for (const event of events) {
            await stream.dispatch(event.toObject ? event.toObject() : event);
        }
        Logger.info(`replay ${streamId}: replayed ${events.length} events from position ${fromPosition}`);
        return events.length;
    }

    /**
     * Replay every registered stream.
     * @returns {Promise<object>} replayed event count per streamId
     */
    static async replayAll() {
        const results = {};
        for (const streamId of Object.keys(EventStore.streamsRegistry)) {
            results[streamId] = await ReplayService.replayStream(streamId);
        }
        return results;
    }

    /**
     * Persist a snapshot of the stream's current read-model state at the last
     * applied position. No-op when the stream has no events yet.
     * @param {string} streamId
     * @returns {Promise<void>}
     */
    static async snapshotStream(streamId) {
        const stream = EventStore.getStream(streamId);
        if (!stream) {
            throw new Error(`cannot snapshot unknown stream ${streamId}`);
        }
        if (!stream.snapshotHandler) {
            throw new Error(`stream ${streamId} has no snapshot handler`);
        }
        const position = stream.streamPosition - 1;
        if (position < 0) {
            return;
        }
        const state = await stream.snapshotHandler.captureState();
        await new SnapshotRepository().saveSnapshot(streamId, position, state);
    }
}

export default ReplayService;
