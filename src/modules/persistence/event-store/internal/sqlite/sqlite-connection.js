import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import {Config} from '../../../../../config/config.js';
import {AndromedaLogger} from '../../../../../config/andromeda-logger.js';
import {TABLE_DEFINITIONS} from './table-definitions.js';

const Logger = new AndromedaLogger();

/**
 * sql.js is an in-memory (WASM) SQLite engine with no native compilation
 * requirement, at the cost of not writing to disk continuously like a real
 * SQLite file handle would. To approximate "one shared, externally-inspectable
 * database" across the engine and any embedded containers pointed at the same
 * file, every write exports the whole database back to disk immediately, and
 * every operation reloads from disk first if the file's mtime has moved since
 * this process last saw it. This is best-effort coordination, not real
 * multi-process locking — concurrent writes from two processes in the same
 * instant can still clobber each other. Acceptable for the ephemeral,
 * single-session sandbox use case this is built for; not a substitute for
 * MongoDB under real concurrent load.
 */
export class SqliteConnection {
    static SQL = null;
    static db = null;
    static filePath = null;
    static lastLoadedMtimeMs = 0;

    static async getInstance() {
        if (!SqliteConnection.db) {
            await SqliteConnection.init();
        }
        return SqliteConnection.db;
    }

    static async ensureSqlJs() {
        if (!SqliteConnection.SQL) {
            SqliteConnection.SQL = await initSqlJs();
        }
        return SqliteConnection.SQL;
    }

    static async init() {
        SqliteConnection.filePath = Config.getInstance().sqliteFilePath;
        await SqliteConnection.ensureSqlJs();

        if (fs.existsSync(SqliteConnection.filePath)) {
            const buffer = fs.readFileSync(SqliteConnection.filePath);
            SqliteConnection.db = new SqliteConnection.SQL.Database(buffer);
            SqliteConnection.lastLoadedMtimeMs = fs.statSync(SqliteConnection.filePath).mtimeMs;
            Logger.info(`sqlite: loaded existing database from ${SqliteConnection.filePath}`);
        } else {
            SqliteConnection.db = new SqliteConnection.SQL.Database();
            SqliteConnection.createTables();
            SqliteConnection.persist();
            Logger.info(`sqlite: created new database at ${SqliteConnection.filePath}`);
        }
    }

    static createTables() {
        Object.values(TABLE_DEFINITIONS).forEach((table) => {
            SqliteConnection.db.run(table.ddl);
        });
    }

    /**
     * Deletes any existing database file and starts fresh. Only the owning
     * engine process should call this, and only once at its own startup —
     * never a container, which should just connect to whatever the engine
     * already created.
     */
    static async reset() {
        SqliteConnection.filePath = Config.getInstance().sqliteFilePath;
        await SqliteConnection.ensureSqlJs();

        if (fs.existsSync(SqliteConnection.filePath)) {
            fs.unlinkSync(SqliteConnection.filePath);
            Logger.info(`sqlite: reset — deleted existing database at ${SqliteConnection.filePath}`);
        }
        SqliteConnection.db = new SqliteConnection.SQL.Database();
        SqliteConnection.createTables();
        SqliteConnection.persist();
    }

    /**
     * Reloads from disk if the file has changed since this process last read
     * or wrote it (i.e. the other process — engine or container — wrote
     * something new). Call before any read/write.
     */
    static reloadIfStale() {
        if (!SqliteConnection.filePath || !fs.existsSync(SqliteConnection.filePath)) {
            return;
        }
        const mtimeMs = fs.statSync(SqliteConnection.filePath).mtimeMs;
        if (mtimeMs > SqliteConnection.lastLoadedMtimeMs) {
            const buffer = fs.readFileSync(SqliteConnection.filePath);
            SqliteConnection.db = new SqliteConnection.SQL.Database(buffer);
            SqliteConnection.lastLoadedMtimeMs = mtimeMs;
        }
    }

    /** Exports the in-memory database back to the shared file. Call after any write. */
    static persist() {
        const bytes = SqliteConnection.db.export();
        fs.mkdirSync(path.dirname(SqliteConnection.filePath), {recursive: true});
        fs.writeFileSync(SqliteConnection.filePath, Buffer.from(bytes));
        SqliteConnection.lastLoadedMtimeMs = fs.statSync(SqliteConnection.filePath).mtimeMs;
    }

    static close() {
        if (SqliteConnection.db) {
            SqliteConnection.persist();
            SqliteConnection.db.close();
            SqliteConnection.db = null;
        }
    }
}

export default SqliteConnection;
