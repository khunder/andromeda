import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {EmbeddedContainerService} from "../../src/modules/engine/embedded/embedded.containers.service.js";
import FormData from "form-data";
import PersistenceModule from "../../src/modules/persistence/persistence.module.js";

import {it, expect, describe, beforeAll, afterAll} from 'vitest';

// Covers TimerJobRepository/TimerService's replacement for the old
// fixed-interval polling sweep (see timer.service.js.njk / catch-event.
// processor.js / timer-catch-resume.job.js): a Timer Intermediate Catch
// Event now enqueues a TimerCatchResumeJob for exactly its due time the
// moment the process instance arrives at the node, instead of waiting to be
// discovered by a periodic scan. This test specifically requires
// PERSISTENCE_DRIVER=mongodb (see the run command below) to exercise the
// Mongoose-backed path - the sqlite path (sql.js-backed) is exercised by
// timer-intermediate-catch-event.int.test.js instead (this suite's default
// driver).
//
// Run with: PERSISTENCE_DRIVER=mongodb MONGODB_URI=mongodb://127.0.0.1:27017/andromeda
describe('TimerIntermediateCatchEventJobQueue::Integration', () => {
    const TEST_TIMEOUT = 30000;
    let deploymentId = "cov/timer_catch_jobqueue";
    let testPort;

    beforeAll(async () => {
        try {
            await PersistenceModule.init();
        } catch (e) {
            console.log('PersistenceModule init error (may already be initialized):', e.message);
        }
        testPort = await findAvailablePort();
    }, TEST_TIMEOUT);

    afterAll(async () => {
        try {
            await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, testPort);
        } catch (e) {
            // already stopped
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

    it('resumes a timer catch event via the timer job queue, close to its due time rather than on a fixed poll boundary', async () => {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        // reuses the same PT2S-duration fixture as the sweep-based test
        const bpmnPath = path.join(__dirname, "../resources", "timer-intermediate-catch-event.bpmn");
        expect(fs.existsSync(bpmnPath)).toBe(true);
        const bpmnXml = fs.readFileSync(bpmnPath, {encoding: 'utf8'});

        let ctx = await Utils.prepareContainerContext([bpmnXml], deploymentId);
        await new EngineService().generateContainer(ctx);

        await EmbeddedContainerService.startEmbeddedContainer(deploymentId, {port: testPort});

        const form = new FormData();
        form.append('bpmnFile', fs.readFileSync(bpmnPath), {
            filename: 'timer-intermediate-catch-event.bpmn',
            contentType: 'application/xml'
        });
        form.append('deploymentId', 'compileBpmn');

        const startedAt = Date.now();
        const response = await fetch(`http://127.0.0.1:${testPort}/TimerIntermediateCatchEvent/start`, {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        expect(response.ok).toBe(true);
        const procData = await response.json();
        expect(procData.id).toBeDefined();

        const pendingFlowEvent = await waitForFlowEventCount(procData.id, 'Flow_2', TEST_TIMEOUT - 10000);
        expect(pendingFlowEvent).toBe(1);
        const flow3CountBeforeElapsed = await PersistenceModule.countDocuments("FlowEvent", {
            processInstance: procData.id,
            flowId: 'Flow_3'
        });
        expect(flow3CountBeforeElapsed).toBe(0);

        const processInstance = await waitForProcessInstanceCompletion(procData.id, TEST_TIMEOUT - 10000);
        expect(processInstance).toBeDefined();
        expect(processInstance.status).toBe(1); // Completed

        // the real point of the queue-based replacement: this should resolve
        // close to the 2s duration, not "wherever the next 10s sweep tick
        // happened to land" (which could take up to ~10s under the old
        // mechanism for the exact same fixture)
        const elapsedMs = Date.now() - startedAt;
        console.log(`resumed ${elapsedMs}ms after /start (duration was 2000ms)`);
        expect(elapsedMs).toBeLessThan(6000);

        const stageAfter = await PersistenceModule.findOne("Variable", {
            processInstance: procData.id,
            name: 'stage'
        });
        expect(stageAfter.value).toBe('elapsed');
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

    async function waitForFlowEventCount(processInstanceId, flowId, timeoutMs) {
        const pollIntervalMs = 250;
        const deadline = Date.now() + timeoutMs;
        let count = 0;
        while (Date.now() < deadline) {
            count = await PersistenceModule.countDocuments("FlowEvent", {
                processInstance: processInstanceId,
                flowId: flowId
            });
            if (count >= 1) {
                return count;
            }
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
        return count;
    }

    async function waitForProcessInstanceCompletion(processInstanceId, timeoutMs) {
        const pollIntervalMs = 250;
        const deadline = Date.now() + timeoutMs;
        let processInstance = null;
        while (Date.now() < deadline) {
            processInstance = await PersistenceModule.findOne("ProcessInstance", {_id: processInstanceId});
            if (processInstance && processInstance.status === 1) {
                return processInstance;
            }
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
        return processInstance;
    }
});
