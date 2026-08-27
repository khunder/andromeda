import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {EmbeddedContainerService} from "../../src/modules/engine/embedded/embedded.containers.service.js";
import FormData from "form-data";
import PersistenceModule from "../../src/modules/persistence/persistence.module.js";

import { it, expect, describe, beforeAll, afterAll } from 'vitest';

// Regression coverage for variable transcoding as it actually happens at
// runtime: script tasks execute inside a worker_threads Worker
// (runScriptTaskInWorker), and the worker's returned variable snapshot gets
// merged back onto the live context via applySnapshot(), which re-runs EVERY
// declared variable through its setter (VariableEncoder.transcodeVariable) ,
// not just the ones the script actually touched. That's a materially
// different code path than calling VariableEncoder.transcodeVariable()
// directly (see transcode-variable-encoder.ava.test.js), and it's the path
// that surfaced a real bug: a declared boolean variable left untouched by a
// script task threw "cannot transcode variable ... of type boolean" because
// its untouched value is Variable's own null default, not undefined.
describe('TranscodeVariablesWorker::Integration', () => {
    const TEST_TIMEOUT = 30000; // 30 seconds timeout for integration test
    let deploymentId = "cov/transcode_variables_worker";
    let testPort;
    let ctx;

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
            await EmbeddedContainerService.stopEmbeddedContainer(ctx?.deploymentId || deploymentId, testPort);
        } catch (e) {
            // Container might already be stopped
        }

        // Clean up deployment folder
        try {
            const deploymentPath = path.join(process.cwd(), 'deployments', ctx?.deploymentId || deploymentId);
            if (fs.existsSync(deploymentPath)) {
                fs.rmSync(deploymentPath, { recursive: true, force: true });
            }
        } catch (e) {
            console.error('Cleanup error:', e);
        }
    });

    it('does not crash on a declared boolean variable left untouched by a worker script task, and correctly transcodes it once a later task sets it', async () => {
        // Setup
        let fileContents = [];
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const bpmnPath = path.join(__dirname, "../resources", "untouched-boolean-variable.bpmn");

        expect(fs.existsSync(bpmnPath), `BPMN file not found at ${bpmnPath}`).toBe(true);

        fileContents.push(fs.readFileSync(bpmnPath, {encoding: 'utf8'}));

        /**
         * @type {ContainerParsingContext} containerParsingContext
         */
        ctx = await Utils.prepareContainerContext(fileContents, deploymentId);
        ctx.includeGalaxyModule = true;

        // Generate container
        const engineService = new EngineService();
        await engineService.generateContainer(ctx);

        // Start embedded container with dynamic port
        await EmbeddedContainerService.startEmbeddedContainer(ctx.deploymentId, {port: testPort});

        // Prepare form data
        const form = new FormData();
        form.append('bpmnFile', fs.readFileSync(bpmnPath), {
            filename: 'untouched-boolean-variable.bpmn',
            contentType: 'application/xml'
        });
        form.append('deploymentId', 'compileBpmn');

        // Make request to start process using native fetch
        let response;
        let procData;
        try {
            response = await fetch(`http://127.0.0.1:${testPort}/UntouchedBooleanVariable/start`, {
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

        // The workflow (SetAge -> SetAdult -> End) runs fire-and-forget after
        // /start responds. If SetAge's own applySnapshot() call crashed on
        // the untouched `isAdult` variable (the bug), the process instance
        // would never reach EndEvent and would never complete , so wait for
        // completion rather than for a specific variable, since a crash here
        // manifests as "never finishes", not as an assertion failure on a
        // wrong value.
        const processInstance = await waitForProcessInstanceCompletion(procData.id, TEST_TIMEOUT - 5000);
        expect(processInstance).toBeDefined();
        expect(processInstance.status).toBe(1); // Completed

        // SetAge only touches `age`; SetAdult only then sets `isAdult` from
        // it. Both went through the worker -> applySnapshot -> transcode
        // round trip, so both must have persisted with correctly transcoded
        // values (variables are persisted as strings, per project
        // convention: see docs/EventSourcing.md).
        const ageVariable = await PersistenceModule.findOne("Variable", {
            processInstance: procData.id,
            name: 'age'
        });
        expect(ageVariable).toBeDefined();
        expect(ageVariable.value).toBe('20');

        const isAdultVariable = await PersistenceModule.findOne("Variable", {
            processInstance: procData.id,
            name: 'isAdult'
        });
        expect(isAdultVariable).toBeDefined();
        expect(isAdultVariable.value).toBe('true');

        // Cleanup
        await EmbeddedContainerService.stopEmbeddedContainer(ctx.deploymentId, testPort);
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

    // Polls the ProcessInstance table until it reaches Completed status (1)
    // (or the timeout elapses), since the workflow runs asynchronously after
    // /start responds.
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
