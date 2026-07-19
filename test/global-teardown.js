import { config as loadDotEnvConfig } from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { resolveSharedDbPath } from "./sqlite-test-db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// vitest's globalSetup runs in the main process, separately from the
// per-test-file workers test/setup.js runs in , it needs its own dotenv load
// to see SINGLE_TEST_DB/DELETE_SINGLE_DB_ON_FINISH.
loadDotEnvConfig({ path: path.resolve(__dirname, ".env") });

// Runs exactly once, after every test file has finished , the only point at
// which it's safe to delete the shared SINGLE_TEST_DB file without yanking
// it out from under a still-running test file.
export async function teardown() {
    if (process.env.SINGLE_TEST_DB !== "true" || process.env.DELETE_SINGLE_DB_ON_FINISH !== "true") {
        return;
    }
    try {
        fs.unlinkSync(resolveSharedDbPath());
    } catch (e) {
        // already gone, or never created , nothing to clean up
    }
}
