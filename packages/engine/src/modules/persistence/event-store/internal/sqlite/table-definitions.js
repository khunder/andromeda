/**
 * SQLite schema definitions mirroring the Mongoose ORM models one-for-one, so
 * SqliteRepositoryBase can offer the same shape of data as BaseRepository.
 * `jsonFields` lists columns that hold serialized JSON (SQLite has no native
 * object/array column type) and must be parsed on read, stringified on write.
 */

export const TABLE_DEFINITIONS = {
    EventStore: {
        name: 'EventStore',
        ddl: `CREATE TABLE IF NOT EXISTS EventStore (
            _id TEXT PRIMARY KEY,
            streamId TEXT NOT NULL,
            streamPosition INTEGER NOT NULL,
            type TEXT NOT NULL,
            data TEXT,
            metadata TEXT,
            timestamp TEXT NOT NULL,
            UNIQUE(streamId, streamPosition)
        )`,
        jsonFields: ['data', 'metadata'],
    },
    ProcessInstance: {
        name: 'ProcessInstance',
        ddl: `CREATE TABLE IF NOT EXISTS ProcessInstance (
            _id TEXT PRIMARY KEY,
            deploymentId TEXT NOT NULL,
            processDef TEXT NOT NULL,
            status INTEGER NOT NULL DEFAULT 0,
            lock TEXT
        )`,
        jsonFields: ['lock'],
    },
    FlowEvent: {
        name: 'FlowEvent',
        ddl: `CREATE TABLE IF NOT EXISTS FlowEvent (
            _id TEXT PRIMARY KEY,
            flowId TEXT NOT NULL,
            processInstance TEXT NOT NULL,
            status INTEGER NOT NULL DEFAULT 0
        )`,
        jsonFields: [],
    },
    Variable: {
        name: 'Variable',
        ddl: `CREATE TABLE IF NOT EXISTS Variable (
            _id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            value TEXT,
            processDef TEXT NOT NULL,
            deploymentId TEXT NOT NULL,
            processInstance TEXT NOT NULL,
            createdAt TEXT,
            updatedAt TEXT,
            UNIQUE(processInstance, name)
        )`,
        jsonFields: [],
    },
    Task: {
        name: 'Task',
        ddl: `CREATE TABLE IF NOT EXISTS Task (
            _id TEXT PRIMARY KEY,
            deploymentId TEXT NOT NULL,
            processDef TEXT NOT NULL,
            processInstance TEXT NOT NULL,
            nodeId TEXT NOT NULL,
            nodeName TEXT,
            type TEXT NOT NULL,
            status INTEGER NOT NULL DEFAULT 0,
            correlation TEXT,
            createdAt TEXT,
            updatedAt TEXT
        )`,
        jsonFields: ['correlation'],
    },
    TimerTick: {
        name: 'TimerTick',
        ddl: `CREATE TABLE IF NOT EXISTS TimerTick (
            _id TEXT PRIMARY KEY,
            deploymentId TEXT NOT NULL,
            processDef TEXT NOT NULL,
            nodeId TEXT NOT NULL,
            tickKey TEXT NOT NULL,
            createdAt TEXT,
            updatedAt TEXT,
            UNIQUE(deploymentId, processDef, nodeId, tickKey)
        )`,
        jsonFields: [],
    },
    TimerJob: {
        name: 'TimerJob',
        ddl: `CREATE TABLE IF NOT EXISTS TimerJob (
            _id TEXT PRIMARY KEY,
            processInstanceId TEXT NOT NULL,
            nodeId TEXT NOT NULL,
            processDef TEXT NOT NULL,
            state TEXT NOT NULL DEFAULT 'waiting',
            attempt INTEGER NOT NULL DEFAULT 0,
            maxAttempts INTEGER NOT NULL DEFAULT 5,
            availableAt TEXT NOT NULL,
            claimedAt TEXT,
            claimedBy TEXT,
            lastError TEXT,
            createdAt TEXT,
            updatedAt TEXT
        )`,
        jsonFields: [],
    },
    StreamCounter: {
        name: 'StreamCounter',
        ddl: `CREATE TABLE IF NOT EXISTS StreamCounter (
            _id TEXT PRIMARY KEY,
            seq INTEGER NOT NULL DEFAULT 0
        )`,
        jsonFields: [],
    },
    Snapshot: {
        name: 'Snapshot',
        ddl: `CREATE TABLE IF NOT EXISTS Snapshot (
            _id TEXT PRIMARY KEY,
            streamId TEXT NOT NULL,
            streamPosition INTEGER NOT NULL,
            state TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            UNIQUE(streamId, streamPosition)
        )`,
        jsonFields: ['state'],
    },
};

export default TABLE_DEFINITIONS;
