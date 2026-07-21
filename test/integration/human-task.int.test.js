import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {EmbeddedContainerService} from "../../src/modules/engine/embedded/embedded.containers.service.js";
import FormData from "form-data";
import PersistenceModule from "../../src/modules/persistence/persistence.module.js";

import { it, expect, describe, beforeAll, afterAll } from 'vitest';

describe('HumanTask::Integration', () => {
    const TEST_TIMEOUT = 30000;
    let deploymentId = "cov/human_task";
    let testPort;

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
            await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, testPort);
        } catch (e) {
            // already stopped
        }
        try {
            const deploymentPath = path.join(process.cwd(), 'deployments', deploymentId);
            if (fs.existsSync(deploymentPath)) {
                fs.rmSync(deploymentPath, { recursive: true, force: true });
            }
        } catch (e) {
            console.error('Cleanup error:', e);
        }
    });

    it('pauses at a human task, lists it via GET /tasks, and completes it via POST /signal with variables', async () => {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const bpmnPath = path.join(__dirname, "../resources", "human-task.bpmn");
        expect(fs.existsSync(bpmnPath)).toBe(true);
        const bpmnXml = fs.readFileSync(bpmnPath, {encoding: 'utf8'});

        let ctx = await Utils.prepareContainerContext([bpmnXml], deploymentId);
        ctx.includeGalaxyModule = true;
        await new EngineService().generateContainer(ctx);

        await EmbeddedContainerService.startEmbeddedContainer(deploymentId, {port: testPort});

        const form = new FormData();
        form.append('bpmnFile', fs.readFileSync(bpmnPath), {
            filename: 'human-task.bpmn',
            contentType: 'application/xml'
        });
        form.append('deploymentId', 'compileBpmn');

        const startResponse = await fetch(`http://127.0.0.1:${testPort}/HumanTaskTest/start`, {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        expect(startResponse.ok).toBe(true);
        const procData = await startResponse.json();
        expect(procData.id).toBeDefined();

        // Runs fire-and-forget after /start responds; poll for the pending
        // flow event into the human task.
        const pendingFlowEvent = await waitForFlowEventCount(procData.id, 'Flow_2', TEST_TIMEOUT - 10000);
        expect(pendingFlowEvent).toBe(1);
        const processInstanceBeforeSignal = await PersistenceModule.findOne("ProcessInstance", {_id: procData.id});
        expect(processInstanceBeforeSignal.status).toBe(0); // Active, still paused

        // GET /tasks must list this exact pending task so an external caller
        // (a UI, a worklist) can discover it without prior knowledge of the
        // node id.
        const tasksResponse = await fetch(`http://127.0.0.1:${testPort}/HumanTaskTest/tasks`);
        expect(tasksResponse.ok).toBe(true);
        const tasks = await tasksResponse.json();
        const thisTask = tasks.find((t) => t.processInstanceId === procData.id);
        expect(thisTask).toBeDefined();
        expect(thisTask.nodeId).toBe('ReviewTask');
        expect(thisTask.nodeName).toBe('Review submission');

        // Complete the task, submitting a variable as if it were form output.
        const signalResponse = await fetch(`http://127.0.0.1:${testPort}/HumanTaskTest/signal`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({
                processInstanceId: procData.id,
                nodeId: 'ReviewTask',
                variables: {stage: 'approved'}
            })
        });
        expect(signalResponse.ok).toBe(true);
        const signalData = await signalResponse.json();
        expect(signalData.resumed).toBe(true);

        const processInstance = await waitForProcessInstanceCompletion(procData.id, TEST_TIMEOUT - 10000);
        expect(processInstance).toBeDefined();
        expect(processInstance.status).toBe(1); // Completed

        const stage = await PersistenceModule.findOne("Variable", {
            processInstance: procData.id,
            name: 'stage'
        });
        expect(stage.value).toBe('approved');

        // The completed task must no longer show up as pending.
        const tasksAfterResponse = await fetch(`http://127.0.0.1:${testPort}/HumanTaskTest/tasks`);
        const tasksAfter = await tasksAfterResponse.json();
        expect(tasksAfter.find((t) => t.processInstanceId === procData.id)).toBeUndefined();

        await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, testPort);
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
