import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {EmbeddedContainerService} from "../../src/modules/engine/embedded/embedded.containers.service.js";
import FormData from "form-data";
import PersistenceModule from "../../src/modules/persistence/persistence.module.js";

import { it, expect, describe, beforeAll, afterAll } from 'vitest';

describe('IntermediateCatchEventSignal::Integration', () => {
    const TEST_TIMEOUT = 30000; // 30 seconds timeout for integration test
    let deploymentId = "cov/intermediate_catch_event_signal";
    let testPort;

    beforeAll(async () => {
        // Initialize PersistenceModule
        try {
            await PersistenceModule.init();
        } catch (e) {
            console.log('PersistenceModule init error (may already be initialized):', e.message);
        }

        // Use a dynamic port to avoid conflicts
        testPort = await findAvailablePort();
        console.log(`Using port ${testPort} for test`);
    }, TEST_TIMEOUT);

    afterAll(async () => {
        // Clean up: stop container if still running
        try {
            await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, testPort);
        } catch (e) {
            // Container might already be stopped
        }

        // Clean up deployment folder
        try {
            const deploymentPath = path.join(process.cwd(), 'deployments', deploymentId);
            if (fs.existsSync(deploymentPath)) {
                fs.rmSync(deploymentPath, { recursive: true, force: true });
            }
        } catch (e) {
            console.error('Cleanup error:', e);
        }
    });

    it('pauses at an intermediate catch event, then resumes and completes once signaled', async () => {
        // Setup
        let fileContents = [];
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const bpmnPath = path.join(__dirname, "../resources", "intermediate-catch-event-signal.bpmn");

        expect(fs.existsSync(bpmnPath), `BPMN file not found at ${bpmnPath}`).toBe(true);

        fileContents.push(fs.readFileSync(bpmnPath, {encoding: 'utf8'}));

        /**
         * @type {ContainerParsingContext} containerParsingContext
         */
        let ctx = await Utils.prepareContainerContext(fileContents, deploymentId);
        ctx.includeGalaxyModule = true;

        // Generate container
        const engineService = new EngineService();
        await engineService.generateContainer(ctx);

        // Start embedded container with dynamic port
        await EmbeddedContainerService.startEmbeddedContainer(deploymentId, {port: testPort});

        // Prepare form data
        const form = new FormData();
        form.append('bpmnFile', fs.readFileSync(bpmnPath), {
            filename: 'intermediate-catch-event-signal.bpmn',
            contentType: 'application/xml'
        });
        form.append('deploymentId', 'compileBpmn');

        // Make request to start process using native fetch
        let response;
        let procData;
        try {
            response = await fetch(`http://127.0.0.1:${testPort}/start`, {
                method: 'POST',
                body: form,
                headers: form.getHeaders()
            });

            expect(response.ok).toBe(true);
            expect(response.status).toBe(200);

            procData = await response.json();
            expect(procData).toBeDefined();
            expect(procData.id).toBeDefined();
        } catch (error) {
            console.error('Failed to start process:', error.message);
            if (response && !response.ok) {
                const errorText = await response.text();
                console.error('Response error:', errorText);
            }
            throw error;
        }

        // The workflow (SetInitial -> WaitForApproval -> SetApproved -> End)
        // runs fire-and-forget after /start responds, so poll for the flow
        // event into the catch event to show up as the pending marker of
        // "we're now paused here" (see catch-event.processor.js).
        const pendingFlowEvent = await waitForFlowEventCount(procData.id, 'Flow_2', TEST_TIMEOUT - 5000);
        expect(pendingFlowEvent).toBe(1);

        // Confirm it's genuinely paused, not just slow: the process instance
        // must still be Active, and the catch event's own outgoing flow
        // (Flow_3) must never have fired yet.
        const processInstanceBeforeSignal = await PersistenceModule.findOne("ProcessInstance", {_id: procData.id});
        expect(processInstanceBeforeSignal.status).toBe(0); // Active, not Completed
        const flow3CountBeforeSignal = await PersistenceModule.countDocuments("FlowEvent", {
            processInstance: procData.id,
            flowId: 'Flow_3'
        });
        expect(flow3CountBeforeSignal).toBe(0);
        const stageBeforeSignal = await PersistenceModule.findOne("Variable", {
            processInstance: procData.id,
            name: 'stage'
        });
        expect(stageBeforeSignal.value).toBe('start');

        // Deliver the signal to resume it
        const signalResponse = await fetch(`http://127.0.0.1:${testPort}/signal`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({processInstanceId: procData.id, nodeId: 'WaitForApproval'})
        });
        expect(signalResponse.ok).toBe(true);
        expect(signalResponse.status).toBe(200);
        const signalData = await signalResponse.json();
        expect(signalData.resumed).toBe(true);

        // Execution resumes fire-and-forget again, so poll for completion.
        const processInstance = await waitForProcessInstanceCompletion(procData.id, TEST_TIMEOUT - 5000);
        expect(processInstance).toBeDefined();
        expect(processInstance.status).toBe(1); // Completed

        const stageAfterSignal = await PersistenceModule.findOne("Variable", {
            processInstance: procData.id,
            name: 'stage'
        });
        expect(stageAfterSignal.value).toBe('approved');

        // A second signal to the same (now-resumed) node must be rejected:
        // the flow event it depended on is no longer Active.
        const secondSignalResponse = await fetch(`http://127.0.0.1:${testPort}/signal`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({processInstanceId: procData.id, nodeId: 'WaitForApproval'})
        });
        expect(secondSignalResponse.status).toBe(409);

        // Cleanup
        await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, testPort);
    }, TEST_TIMEOUT);

    // Helper function to find available port
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

    // Polls the FlowEvent table until the given flow's count reaches 1 (or
    // the timeout elapses), since the workflow runs asynchronously after
    // /start responds.
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

    // Polls the ProcessInstance table until it reaches Completed status (1)
    // (or the timeout elapses).
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
