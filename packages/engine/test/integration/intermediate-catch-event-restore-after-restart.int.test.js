import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {EmbeddedContainerService} from "../../src/modules/engine/embedded/embedded.containers.service.js";
import FormData from "form-data";
import PersistenceModule from "../../src/modules/persistence/persistence.module.js";

import { it, expect, describe, beforeAll, afterAll } from 'vitest';

// Companion to intermediate-catch-event-signal.int.test.js: that test covers
// resuming a catch event while the process instance is still live in the
// same container process's memory. This one covers the case
// catch-event.processor.js originally called a "known limitation" —
// resuming after the container that paused the instance is gone — which
// {ProcessDef}ProcessInstanceService.restoreInstance() (inspired by
// jsflow's createInstance(id) restore path) now handles: reconstruct the
// instance from persisted state and rehydrate its variables before
// resuming, rather than 404ing just because nothing is in memory anymore.
describe('IntermediateCatchEventRestoreAfterRestart::Integration', () => {
    const TEST_TIMEOUT = 30000;
    let deploymentId = "cov/intermediate_catch_event_restore";
    let portA;
    let portB;
    let ctx;

    beforeAll(async () => {
        try {
            await PersistenceModule.init();
        } catch (e) {
            console.log('PersistenceModule init error (may already be initialized):', e.message);
        }
        portA = await findAvailablePort();
        portB = await findAvailablePort();
        console.log(`Using ports ${portA} (first container) / ${portB} (post-restart container)`);
    }, TEST_TIMEOUT);

    afterAll(async () => {
        try {
            await EmbeddedContainerService.stopEmbeddedContainer(ctx?.deploymentId || deploymentId, portA);
        } catch (e) {
            // already stopped
        }
        try {
            await EmbeddedContainerService.stopEmbeddedContainer(ctx?.deploymentId || deploymentId, portB);
        } catch (e) {
            // may already be stopped
        }
        try {
            const deploymentPath = path.join(process.cwd(), 'deployments', ctx?.deploymentId || deploymentId);
            if (fs.existsSync(deploymentPath)) {
                fs.rmSync(deploymentPath, { recursive: true, force: true });
            }
        } catch (e) {
            console.error('Cleanup error:', e);
        }
    });

    it('restores a paused process instance from persistence and resumes it after the pausing container is gone', async () => {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const bpmnPath = path.join(__dirname, "../resources", "intermediate-catch-event-signal.bpmn");
        expect(fs.existsSync(bpmnPath)).toBe(true);
        const bpmnXml = fs.readFileSync(bpmnPath, {encoding: 'utf8'});

        ctx = await Utils.prepareContainerContext([bpmnXml], deploymentId);
        ctx.includeGalaxyModule = true;
        await new EngineService().generateContainer(ctx);

        // First container: start the process and let it pause at the catch event.
        await EmbeddedContainerService.startEmbeddedContainer(ctx.deploymentId, {port: portA});

        const form = new FormData();
        form.append('bpmnFile', fs.readFileSync(bpmnPath), {
            filename: 'intermediate-catch-event-signal.bpmn',
            contentType: 'application/xml'
        });
        form.append('deploymentId', 'compileBpmn');

        const startResponse = await fetch(`http://127.0.0.1:${portA}/IntermediateCatchEventSignal/start`, {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        expect(startResponse.ok).toBe(true);
        const procData = await startResponse.json();
        expect(procData.id).toBeDefined();

        const pendingFlowEvent = await waitForFlowEventCount(procData.id, 'Flow_2', TEST_TIMEOUT - 15000);
        expect(pendingFlowEvent).toBe(1);
        const processInstanceBeforeStop = await PersistenceModule.findOne("ProcessInstance", {_id: procData.id});
        expect(processInstanceBeforeStop.status).toBe(0); // Active, still paused

        // Simulate a container restart: stop the first container entirely
        // (its in-memory ContainerService.processInstances registry, and
        // this specific instance object with it, is gone) and start a brand
        // new one for the same deployment against the same persisted state.
        await EmbeddedContainerService.stopEmbeddedContainer(ctx.deploymentId, portA);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await EmbeddedContainerService.startEmbeddedContainer(ctx.deploymentId, {port: portB});

        // Signal the *new* container process — it has never seen this
        // process instance in memory, so this only works if it restores the
        // instance (and its variables) from persistence first.
        const signalResponse = await fetch(`http://127.0.0.1:${portB}/IntermediateCatchEventSignal/signal`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({processInstanceId: procData.id, nodeId: 'WaitForApproval'})
        });
        const signalBody = await signalResponse.text();
        expect(signalResponse.ok, `signal response: ${signalResponse.status} ${signalBody}`).toBe(true);
        expect(JSON.parse(signalBody).resumed).toBe(true);

        const processInstance = await waitForProcessInstanceCompletion(procData.id, TEST_TIMEOUT - 15000);
        expect(processInstance).toBeDefined();
        expect(processInstance.status).toBe(1); // Completed

        // The pre-pause variable (set by the *first* container, before the
        // restart) must have survived the restore, and the post-signal
        // script task (run by the *second* container) must have updated it
        // correctly on top of the restored value.
        const stage = await PersistenceModule.findOne("Variable", {
            processInstance: procData.id,
            name: 'stage'
        });
        expect(stage.value).toBe('approved');

        await EmbeddedContainerService.stopEmbeddedContainer(ctx.deploymentId, portB);
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
