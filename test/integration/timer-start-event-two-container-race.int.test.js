import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {EmbeddedContainerService} from "../../src/modules/engine/embedded/embedded.containers.service.js";
import PersistenceModule from "../../src/modules/persistence/persistence.module.js";

import {it, expect, describe, beforeAll, afterAll} from 'vitest';

// Companion to timer-tick-claim.int.test.js and timer-start-event.int.test.js:
// those prove the claim primitive itself is exact (in-process) and that
// scheduling works end-to-end (one container). This test is the actual
// scenario the HA mechanism was built for: two container replicas of the
// *same* deployment, both scheduled off the *same* cron, racing to claim the
// *same* tick - the "two containers of the same bpmn running" case described
// when this feature was requested.
//
// Important caveat, called out explicitly rather than glossed over: real
// atomicity for PersistenceGateway.claimTimerTick() is only guaranteed under
// MongoDB. This repo's sqlite driver (sql.js/WASM) is documented best-effort,
// non-atomic multi-process file coordination (see SqliteConnection's own
// doc comment) - two real OS processes racing to insert at the same instant
// can each succeed against their own in-memory copy before either has seen
// the other's write. That's an accepted, deliberate tradeoff (sqlite here is
// a dev/test convenience, not the HA deployment target), so this test uses
// tolerant bounds rather than asserting a mathematically exact one-instance-
// per-tick outcome, and documents why: an occasional collision under the
// test suite's default sqlite driver is a known limitation, not evidence the
// mechanism is broken. A hard regression (dedupe not wired up at all) would
// still fail this test loudly, since every tick would double up instead of
// occasionally one tick doing so.
//
// In practice this rarely even matters: on the rare tick where both
// replicas' local sqlite views really did race past the TimerTick claim,
// EventStore's own sequential streamPosition uniqueness constraint (shared
// by every event-sourced write, not just this one) tends to reject the
// second writer's process-instance-creation attempt too - so the observed
// failure mode under sqlite is "one replica's attempt for that tick errors
// out" (a possible missed tick), not "both replicas succeed" (an actual
// duplicate instance). That's an incidental second line of defense, not
// something to rely on in place of the real fix (MongoDB in production).
describe('TimerStartEventTwoContainerRace::Integration', () => {
    const TEST_TIMEOUT = 45000;
    let deploymentId = "cov/timer_start_event_race";
    let portA;
    let portB;

    beforeAll(async () => {
        try {
            await PersistenceModule.init();
        } catch (e) {
            console.log('PersistenceModule init error (may already be initialized):', e.message);
        }
        portA = await findAvailablePort();
        portB = await findAvailablePort();
        console.log(`Using ports ${portA} / ${portB} for the two racing container replicas`);
    }, TEST_TIMEOUT);

    afterAll(async () => {
        try {
            await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, portA);
        } catch (e) {
            // already stopped
        }
        try {
            await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, portB);
        } catch (e) {
            // may already be stopped
        }
        try {
            const deploymentPath = path.join(process.cwd(), 'deployments', deploymentId);
            if (fs.existsSync(deploymentPath)) {
                fs.rmSync(deploymentPath, {recursive: true, force: true});
            }
        } catch (e) {
            console.error('Cleanup error:', e);
        }
    });

    it('does not let both replicas independently create an instance for every cron tick', async () => {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        // reuses the same fixture as timer-start-event.int.test.js: a Timer
        // Start Event firing every 2 seconds
        const bpmnPath = path.join(__dirname, "../resources", "timer-start-event.bpmn");
        expect(fs.existsSync(bpmnPath)).toBe(true);
        const bpmnXml = fs.readFileSync(bpmnPath, {encoding: 'utf8'});

        let ctx = await Utils.prepareContainerContext([bpmnXml], deploymentId);
        await new EngineService().generateContainer(ctx);

        // Both replicas run the exact same compiled deployment folder and
        // (via inherited env vars, see EmbeddedContainerService.
        // startEmbeddedContainer) the exact same shared persistence - true
        // replicas of one deployment, not two independent deployments.
        const startedAt = Date.now();
        await EmbeddedContainerService.startEmbeddedContainer(deploymentId, {port: portA});
        await EmbeddedContainerService.startEmbeddedContainer(deploymentId, {port: portB});

        // let several ticks elapse with both replicas racing every one of them
        const RUN_TIME_MS = 8500;
        await new Promise((resolve) => setTimeout(resolve, RUN_TIME_MS));

        const elapsedMs = Date.now() - startedAt;
        const expectedTicks = Math.floor(elapsedMs / 2000);

        const completedCount = await PersistenceModule.countDocuments("ProcessInstance", {
            deploymentId,
            status: 1
        });

        console.log(`elapsed ~${elapsedMs}ms (~${expectedTicks} ticks), ${completedCount} completed process instance(s) created by the two racing replicas combined`);

        // the real regression this guards against: dedupe not wired up at
        // all, where *every* tick would be doubled (completedCount ~= 2 *
        // expectedTicks). A little slack either way absorbs normal polling-
        // window rounding plus the sqlite best-effort caveat documented above.
        expect(completedCount).toBeGreaterThanOrEqual(Math.max(1, expectedTicks - 1));
        expect(completedCount).toBeLessThanOrEqual(expectedTicks + 1);

        await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, portA);
    }, TEST_TIMEOUT);

    async function findAvailablePort() {
        const net = await import('net');
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.listen(0, '127.0.0.1', () => {
                const port = server.address().port;
                server.close(() => resolve(port));
            });
            server.on('error', reject);
        });
    }
});
