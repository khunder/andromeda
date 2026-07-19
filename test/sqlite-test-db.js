import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * SINGLE_TEST_DB=true: every test file/worker shares one fixed sqlite file
 * instead of getting its own private one , useful when you want to poke at
 * the database with an external sqlite viewer while a run is in progress, or
 * when you're only running a single test file at a time anyway. Off by
 * default: sql.js's shared-file coordination (SqliteConnection) is
 * best-effort, not real multi-process locking, so concurrently-run test
 * files sharing one file can reset/overwrite each other's data mid-run (see
 * test/setup.js for the per-file-unique default this opts out of).
 */
export function resolveSharedDbPath() {
    return path.join(__dirname, "andromeda-test-shared.sqlite");
}

/** Unique per test-file/worker execution: pid + a fresh random suffix. */
export function resolveUniqueDbPath() {
    const uniqueSuffix = `${process.pid}-${crypto.randomUUID()}`;
    return path.join(__dirname, `andromeda-test-${uniqueSuffix}.sqlite`);
}

export function resolveSqliteTestFilePath() {
    if (process.env.SINGLE_TEST_DB === "true") {
        return resolveSharedDbPath();
    }
    return resolveUniqueDbPath();
}
