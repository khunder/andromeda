import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {EmbeddedContainerService} from "../../src/modules/engine/embedded/embedded.containers.service.js";
import PersistenceModule from "../../src/modules/persistence/persistence.module.js";

import {it, expect, describe, beforeAll, afterAll} from 'vitest';

describe('TimerStartEvent::Integration', () => {
    const TEST_TIMEOUT = 30000;
    let deploymentId = "cov/timer_start_event";
    let testPort;
    let ctx;

    beforeAll(async () => {
        try {
            await PersistenceModule.init();
        } catch (e) {
            console.log('PersistenceModule init error (may already be initialized):', e.message);
        }
        testPort = await findAvailablePort();
        console.log(`Using port ${testPort} for test`);
    }, TEST_TIMEOUT);

    afterAll(async () => {
        try {
            await EmbeddedContainerService.stopEmbeddedContainer(ctx?.deploymentId || deploymentId, testPort);
        } catch (e) {
            // Container might already be stopped
        }
        try {
            const deploymentPath = path.join(process.cwd(), 'deployments', ctx?.deploymentId || deploymentId);
            if (fs.existsSync(deploymentPath)) {
                fs.rmSync(deploymentPath, {recursive: true, force: true});
            }
        } catch (e) {
            console.error('Cleanup error:', e);
        }
    });

    // A Timer Start Event (<bpmn:timeCycle>*/2 * * * * *</bpmn:timeCycle>)
    // creates new process instances entirely on its own - no HTTP /start call
    // at all - via timer.service.js's node-cron schedule read from
    // TimerModel. See timer-tick-claim.int.test.js for the HA dedupe
    // guarantee (PersistenceGateway.claimTimerTick) that keeps multiple
    // container replicas of the same deployment from each creating their own
    // instance for the same tick; this test just proves the scheduling
    // itself actually fires end-to-end in a real container.
    it('automatically creates and completes a new process instance on every cron tick, without any /start call', async () => {
        let fileContents = [];
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const bpmnPath = path.join(__dirname, "../resources", "timer-start-event.bpmn");

        expect(fs.existsSync(bpmnPath), `BPMN file not found at ${bpmnPath}`).toBe(true);
        fileContents.push(fs.readFileSync(bpmnPath, {encoding: 'utf8'}));

        ctx = await Utils.prepareContainerContext(fileContents, deploymentId);

        const engineService = new EngineService();
        await engineService.generateContainer(ctx);

        await EmbeddedContainerService.startEmbeddedContainer(ctx.deploymentId, {port: testPort});

        // the cron fires every 2s - poll for at least 2 completed instances,
        // proving multiple ticks each independently created and ran an instance
        const completedCount = await waitForCompletedInstanceCount(ctx.deploymentId, 2, TEST_TIMEOUT - 5000);
        expect(completedCount).toBeGreaterThanOrEqual(2);

        const markerFiredCount = await PersistenceModule.countDocuments("Variable", {
            deploymentId: ctx.deploymentId,
            name: 'marker',
            value: 'fired'
        });
        expect(markerFiredCount).toBeGreaterThanOrEqual(2);

        await EmbeddedContainerService.stopEmbeddedContainer(ctx.deploymentId, testPort);
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

    async function waitForCompletedInstanceCount(deploymentId, minCount, timeoutMs) {
        const pollIntervalMs = 250;
        const deadline = Date.now() + timeoutMs;
        let count = 0;
        while (Date.now() < deadline) {
            count = await PersistenceModule.countDocuments("ProcessInstance", {deploymentId, status: 1});
            if (count >= minCount) {
                return count;
            }
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
        return count;
    }
});
