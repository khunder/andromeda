import { MongoMemoryServer } from "mongodb-memory-server";
import { config as loadDotEnvConfig } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { resolveSqliteTestFilePath } from "./sqlite-test-db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// test/.env picks the persistence driver for the whole test run (currently
// sqlite) before any test file gets a chance to instantiate Config , dotenv
// never overrides an already-set process.env var, so this must run first.
loadDotEnvConfig({ path: path.resolve(__dirname, ".env") });

// Give this test file its own sqlite file , both isolated from a dev-mode
// engine that might be running with PERSISTENCE_DRIVER=sqlite at the same
// time, and from every other test file. sql.js's shared-file coordination
// (SqliteConnection) is best-effort, not real multi-process locking; vitest
// runs test files across multiple forked processes, and setupFiles re-runs
// fresh for each isolated test file even within the same OS process, so a
// single fixed path would let concurrent files reset/overwrite each other's
// database mid-run. pid + random suffix keeps every file's engine (and the
// embedded containers it spawns, which inherit this path verbatim , see
// embedded.containers.service.js) on a private file. Must stay absolute: a
// spawned container's cwd is the deployment folder, not the repo root.
//
// SINGLE_TEST_DB=true opts every file into one shared, fixed-path database
// instead (see sqlite-test-db.js) , deliberately NOT cleaned up here, since
// deleting it as soon as any one worker exits would yank it out from under
// other test files still running against it; that cleanup is instead handled
// once, globally, after the whole run finishes (test/global-teardown.js),
// gated by DELETE_SINGLE_DB_ON_FINISH.
if (!process.env.SQLITE_FILE_PATH) {
    const sqliteTestFilePath = resolveSqliteTestFilePath();
    process.env.SQLITE_FILE_PATH = sqliteTestFilePath;
    if (process.env.SINGLE_TEST_DB !== "true") {
        process.on("exit", () => {
            try {
                fs.unlinkSync(sqliteTestFilePath);
            } catch (e) {
                // already gone, or never created , nothing to clean up
            }
        });
    }
}

// The root .env sets deploymentId=wee for local dev-mode runs. Left as-is,
// that would leak in here (dotenv never overrides an already-set var, but
// this one *isn't* set yet at this point) and trick
// PersistenceModule.initSqlite()'s "am I the owning engine, or a spawned
// container?" check (presence of deploymentId) into skipping the reset, so
// tests would silently reuse whatever a previous dev run left in the shared
// sqlite file instead of starting from a clean database.
delete process.env.deploymentId;

let mongoServer;

export async function setup() {
    // sqlite-backed test runs don't need a Mongo instance at all
    if (process.env.PERSISTENCE_DRIVER === "sqlite") {
        return;
    }

    process.env.MONGOMS_VERSION = "5.0.3";
    process.env.MONGOMS_DEBUG = "1";

    mongoServer = await MongoMemoryServer.create({
        instance: {
            port: 27018, // by default choose any free port
            ip: "127.0.0.1", // by default '127.0.0.1', for binding to all IP addresses set it to `::,0.0.0.0`,
            dbName: "andromeda", // by default '' (empty string)
        }
    });

    // Store the URI for tests to use
    process.env.MONGO_URI = mongoServer.getUri();

    console.log('MongoDB Memory Server started on:', process.env.MONGO_URI);
}

export async function teardown() {
    if (mongoServer) {
        await mongoServer.stop();
        console.log('MongoDB Memory Server stopped');
    }
}
