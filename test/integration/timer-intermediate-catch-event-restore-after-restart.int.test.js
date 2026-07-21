import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {EmbeddedContainerService} from "../../src/modules/engine/embedded/embedded.containers.service.js";
import FormData from "form-data";
import PersistenceModule from "../../src/modules/persistence/persistence.module.js";

import {it, expect, describe, beforeAll, afterAll} from 'vitest';

// Companion to intermediate-catch-event-restore-after-restart.int.test.js,
// but for a *timer* intermediate catch event instead of a signal-based one:
// proves a timer catch event's TimerCatchResumeJob (not just POST /signal)
// also goes through {ProcessDef}ProcessInstanceService.restoreInstance() when
// the process instance that paused isn't live in the current container
// process's memory - here because the container that paused it was stopped
// and replaced by a brand new one, which never saw this instance get created
// in the first place. The fixture's 8s duration gives plenty of margin to
// detect the pause and swap containers well before the timer is actually
// due, so it doesn't matter that the first container's own Sidequest engine
// (with its own jobPollingInterval) never gets the chance to run the job at
// all - the job is only claimable once `availableAt` passes, and the second
// container's own engine is what ends up claiming and running it.
describe('TimerIntermediateCatchEventRestoreAfterRestart::Integration', () => {
    const TEST_TIMEOUT = 45000;
    let deploymentId = "cov/timer_catch_restore";
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
        console.log(`Using ports ${portA} (first container) / ${portB} (post-restart container)`);
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

    it('auto-resumes a paused timer catch event from persistence, on a container that never saw it get created', async () => {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const bpmnPath = path.join(__dirname, "../resources", "timer-intermediate-catch-event-restore.bpmn");
        expect(fs.existsSync(bpmnPath)).toBe(true);
        const bpmnXml = fs.readFileSync(bpmnPath, {encoding: 'utf8'});

        let ctx = await Utils.prepareContainerContext([bpmnXml], deploymentId);
        await new EngineService().generateContainer(ctx);

        // First container: start the process and let it pause at the timer
        // catch event, but stop it well before the 8s duration elapses -
        // it must never get the chance to resume this instance itself.
        await EmbeddedContainerService.startEmbeddedContainer(deploymentId, {port: portA});

        const form = new FormData();
        form.append('bpmnFile', fs.readFileSync(bpmnPath), {
            filename: 'timer-intermediate-catch-event-restore.bpmn',
            contentType: 'application/xml'
        });
        form.append('deploymentId', 'compileBpmn');

        const startResponse = await fetch(`http://127.0.0.1:${portA}/TimerIntermediateCatchEventRestore/start`, {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        expect(startResponse.ok).toBe(true);
        const procData = await startResponse.json();
        expect(procData.id).toBeDefined();

        const pendingFlowEvent = await waitForFlowEventCount(procData.id, 'Flow_2', TEST_TIMEOUT - 30000);
        expect(pendingFlowEvent).toBe(1);
        const processInstanceBeforeStop = await PersistenceModule.findOne("ProcessInstance", {_id: procData.id});
        expect(processInstanceBeforeStop.status).toBe(0); // Active, still paused
        const flow3CountBeforeStop = await PersistenceModule.countDocuments("FlowEvent", {
            processInstance: procData.id,
            flowId: 'Flow_3'
        });
        expect(flow3CountBeforeStop).toBe(0); // never auto-resumed by the first container

        // Simulate a container restart: stop the first container entirely
        // (its in-memory ContainerService.processInstances registry, and
        // this specific instance object with it, is gone) and start a brand
        // new one for the same deployment against the same persisted state.
        // This happens well inside the 8s window, so the timer is nowhere
        // near due yet.
        await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, portA);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await EmbeddedContainerService.startEmbeddedContainer(deploymentId, {port: portB});

        // No /signal call anywhere - only the *new* container's own
        // TimerCatchResumeJob, which has never seen this process instance
        // before, resuming it via restoreInstance() once the duration elapses.
        const processInstance = await waitForProcessInstanceCompletion(procData.id, TEST_TIMEOUT - 10000);
        expect(processInstance).toBeDefined();
        expect(processInstance.status).toBe(1); // Completed

        // The pre-pause variable (set by the *first* container, before the
        // restart) must have survived the restore, and the post-resume
        // script task (run by the *second* container) must have updated it
        // correctly on top of the restored value.
        const stage = await PersistenceModule.findOne("Variable", {
            processInstance: procData.id,
            name: 'stage'
        });
        expect(stage.value).toBe('elapsed');

        await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, portB);
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
