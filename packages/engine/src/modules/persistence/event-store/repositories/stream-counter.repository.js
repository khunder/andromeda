import {Config} from "../../../../config/config.js";
import StreamCounterModel from "../internal/models/stream-counter.orm-model.js";
import SqliteConnection from "../internal/sqlite/sqlite-connection.js";
import {TABLE_DEFINITIONS} from "../internal/sqlite/table-definitions.js";

// unit-test mode fallback: a single process's own numbers are already
// unique to itself, so a plain in-process counter is sufficient - mirrors
// FakeRepositoryBase's role for the other repositories
const fakeCounters = new Map();

/**
 * Hands out sequential, gap-free (barring a crash between reserving and
 * persisting) streamPosition numbers per streamId, atomically against the
 * shared backend rather than an in-memory per-process counter - see
 * EventStore.updateStreamPosition(). Bypasses RepositoryFactory/
 * BaseRepository/SqliteRepositoryBase deliberately: those model document
 * CRUD, not atomic numeric increment ($inc/$max), and forcing this shape
 * through them would need surgery to their shared, widely-used update()/
 * upsert() methods for a need only this repository has.
 */
export class StreamCounterRepository {

    /**
     * Atomically reserves and returns the next position for `streamId`,
     * starting at 0 for a stream that's never reserved one before.
     * @param {string} streamId
     * @returns {Promise<number>}
     */
    async reserveNext(streamId) {
        if (Config.getInstance().isUnitTestMode) {
            const next = fakeCounters.get(streamId) ?? 0;
            fakeCounters.set(streamId, next + 1);
            return next;
        }
        if (Config.getInstance().persistenceDriver === 'sqlite') {
            return this.reserveNextSqlite(streamId);
        }
        const doc = await StreamCounterModel.findOneAndUpdate(
            {_id: streamId},
            {$inc: {seq: 1}},
            {upsert: true, new: true},
        );
        return doc.seq - 1;
    }

    async reserveNextSqlite(streamId) {
        await SqliteConnection.getInstance();
        SqliteConnection.reloadIfStale();
        const table = TABLE_DEFINITIONS.StreamCounter.name;
        const current = this.readSqliteSeq(streamId);
        if (current == null) {
            SqliteConnection.db.run(`INSERT INTO ${table} (_id, seq) VALUES (?, ?)`, [streamId, 1]);
            SqliteConnection.persist();
            return 0;
        }
        SqliteConnection.db.run(`UPDATE ${table} SET seq = ? WHERE _id = ?`, [current + 1, streamId]);
        SqliteConnection.persist();
        return current;
    }

    /**
     * Ratchets the counter for `streamId` up to at least `minSeq`, never
     * down - called once per stream at container startup to catch a fresh
     * (or otherwise-behind) counter up with whatever's already persisted in
     * the event log, without clobbering a counter that's already ahead
     * (e.g. seeded by another replica that started first).
     * @param {string} streamId
     * @param {number} minSeq
     */
    async ensureAtLeast(streamId, minSeq) {
        if (Config.getInstance().isUnitTestMode) {
            fakeCounters.set(streamId, Math.max(fakeCounters.get(streamId) ?? 0, minSeq));
            return;
        }
        if (Config.getInstance().persistenceDriver === 'sqlite') {
            return this.ensureAtLeastSqlite(streamId, minSeq);
        }
        // $max is a real atomic MongoDB update operator: it only writes
        // when minSeq is greater than the current value (or the field is
        // missing), so this is safe even if several replicas call it
        // concurrently at their own startup
        await StreamCounterModel.updateOne(
            {_id: streamId},
            {$max: {seq: minSeq}},
            {upsert: true},
        );
    }

    async ensureAtLeastSqlite(streamId, minSeq) {
        await SqliteConnection.getInstance();
        SqliteConnection.reloadIfStale();
        const table = TABLE_DEFINITIONS.StreamCounter.name;
        const current = this.readSqliteSeq(streamId);
        if (current != null && minSeq <= current) {
            return;
        }
        if (current == null) {
            SqliteConnection.db.run(`INSERT INTO ${table} (_id, seq) VALUES (?, ?)`, [streamId, minSeq]);
        } else {
            SqliteConnection.db.run(`UPDATE ${table} SET seq = ? WHERE _id = ?`, [minSeq, streamId]);
        }
        SqliteConnection.persist();
    }

    /**
     * @param {string} streamId
     * @returns {number|null} the currently stored seq, or null if this
     *   stream has never reserved a position before
     */
    readSqliteSeq(streamId) {
        const table = TABLE_DEFINITIONS.StreamCounter.name;
        const stmt = SqliteConnection.db.prepare(`SELECT seq FROM ${table} WHERE _id = ?`);
        stmt.bind([streamId]);
        const found = stmt.step();
        const seq = found ? stmt.getAsObject().seq : null;
        stmt.free();
        return seq;
    }
}

export default StreamCounterRepository;
