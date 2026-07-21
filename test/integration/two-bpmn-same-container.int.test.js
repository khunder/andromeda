import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {EmbeddedContainerService} from "../../src/modules/engine/embedded/embedded.containers.service.js";
import FormData from "form-data";
import PersistenceModule from "../../src/modules/persistence/persistence.module.js";

import {it, expect, describe, beforeAll, afterAll} from 'vitest';

// Proves two independent BPMN workflows can be compiled into the SAME
// container and run side by side: each gets its own namespaced routes
// (/{ProcessDef}/start, /signal, /tasks - see workflow.builder.js), its own
// WorkflowModel/service (registry.js), and GET /tasks only ever sees its own
// workflow's pending tasks, never the other's.
describe('TwoBpmnSameContainer::Integration', () => {
    const TEST_TIMEOUT = 30000;
    let deploymentId = "cov/two_bpmn_same_container";
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
            // Container might already be stopped
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

    it('runs a human-task workflow and an intermediate-catch-event workflow independently in one container', async () => {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const humanTaskBpmnPath = path.join(__dirname, "../resources", "human-task.bpmn");
        const catchEventBpmnPath = path.join(__dirname, "../resources", "intermediate-catch-event-signal.bpmn");
        expect(fs.existsSync(humanTaskBpmnPath)).toBe(true);
        expect(fs.existsSync(catchEventBpmnPath)).toBe(true);

        const humanTaskBpmn = fs.readFileSync(humanTaskBpmnPath, {encoding: 'utf8'});
        const catchEventBpmn = fs.readFileSync(catchEventBpmnPath, {encoding: 'utf8'});

        // both BPMN files compiled into the same deploymentId/container
        let ctx = await Utils.prepareContainerContext([humanTaskBpmn, catchEventBpmn], deploymentId);
        await new EngineService().generateContainer(ctx);

        await EmbeddedContainerService.startEmbeddedContainer(deploymentId, {port: testPort});

        // start HumanTaskTest
        const humanTaskForm = new FormData();
        humanTaskForm.append('bpmnFile', fs.readFileSync(humanTaskBpmnPath), {
            filename: 'human-task.bpmn',
            contentType: 'application/xml'
        });
        const humanTaskStartResponse = await fetch(`http://127.0.0.1:${testPort}/HumanTaskTest/start`, {
            method: 'POST',
            body: humanTaskForm,
            headers: humanTaskForm.getHeaders()
        });
        expect(humanTaskStartResponse.ok).toBe(true);
        const humanTaskProc = await humanTaskStartResponse.json();
        expect(humanTaskProc.id).toBeDefined();

        // start IntermediateCatchEventSignal
        const catchEventForm = new FormData();
        catchEventForm.append('bpmnFile', fs.readFileSync(catchEventBpmnPath), {
            filename: 'intermediate-catch-event-signal.bpmn',
            contentType: 'application/xml'
        });
        const catchEventStartResponse = await fetch(`http://127.0.0.1:${testPort}/IntermediateCatchEventSignal/start`, {
            method: 'POST',
            body: catchEventForm,
            headers: catchEventForm.getHeaders()
        });
        expect(catchEventStartResponse.ok).toBe(true);
        const catchEventProc = await catchEventStartResponse.json();
        expect(catchEventProc.id).toBeDefined();

        // both instances must reach their own pausing point independently
        const humanTaskPending = await waitForFlowEventCount(humanTaskProc.id, 'Flow_2', TEST_TIMEOUT - 10000);
        expect(humanTaskPending).toBe(1);
        const catchEventPending = await waitForFlowEventCount(catchEventProc.id, 'Flow_2', TEST_TIMEOUT - 10000);
        expect(catchEventPending).toBe(1);

        // GET /HumanTaskTest/tasks must only ever see HumanTaskTest's own
        // pending task, never IntermediateCatchEventSignal's (which doesn't
        // create a HumanTask-typed Task record at all, but this also proves
        // the processDef filter added to findAllActiveTasks is in effect)
        const tasksResponse = await fetch(`http://127.0.0.1:${testPort}/HumanTaskTest/tasks`);
        expect(tasksResponse.ok).toBe(true);
        const tasks = await tasksResponse.json();
        expect(tasks.length).toBe(1);
        expect(tasks[0].processInstanceId).toBe(humanTaskProc.id);
        expect(tasks[0].nodeId).toBe('ReviewTask');

        // complete HumanTaskTest via its own namespaced /signal
        const humanTaskSignalResponse = await fetch(`http://127.0.0.1:${testPort}/HumanTaskTest/signal`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({processInstanceId: humanTaskProc.id, nodeId: 'ReviewTask', variables: {stage: 'approved'}})
        });
        expect(humanTaskSignalResponse.ok).toBe(true);

        // resume IntermediateCatchEventSignal via its own namespaced /signal
        const catchEventSignalResponse = await fetch(`http://127.0.0.1:${testPort}/IntermediateCatchEventSignal/signal`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({processInstanceId: catchEventProc.id, nodeId: 'WaitForApproval'})
        });
        expect(catchEventSignalResponse.ok).toBe(true);

        const humanTaskInstance = await waitForProcessInstanceCompletion(humanTaskProc.id, TEST_TIMEOUT - 10000);
        expect(humanTaskInstance).toBeDefined();
        expect(humanTaskInstance.status).toBe(1);

        const catchEventInstance = await waitForProcessInstanceCompletion(catchEventProc.id, TEST_TIMEOUT - 10000);
        expect(catchEventInstance).toBeDefined();
        expect(catchEventInstance.status).toBe(1);

        // each workflow's own variable landed on the right process instance
        const humanTaskStage = await PersistenceModule.findOne("Variable", {
            processInstance: humanTaskProc.id,
            name: 'stage'
        });
        expect(humanTaskStage.value).toBe('approved');

        const catchEventStage = await PersistenceModule.findOne("Variable", {
            processInstance: catchEventProc.id,
            name: 'stage'
        });
        expect(catchEventStage.value).toBe('approved');

        // the completed HumanTaskTest task must no longer be pending
        const tasksAfterResponse = await fetch(`http://127.0.0.1:${testPort}/HumanTaskTest/tasks`);
        const tasksAfter = await tasksAfterResponse.json();
        expect(tasksAfter.length).toBe(0);
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
