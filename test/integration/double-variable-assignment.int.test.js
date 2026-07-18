import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {EmbeddedContainerService} from "../../src/modules/engine/embedded/embedded.containers.service.js";
import FormData from "form-data";
import PersistenceModule from "../../src/modules/persistence/persistence.module.js";

import { it, expect, describe, beforeAll, afterAll } from 'vitest';

describe('DoubleVariableAssignment::Integration', () => {
    const TEST_TIMEOUT = 30000; // 30 seconds timeout for integration test
    let deploymentId = "cov/double_variable_assignment";
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

    it('persists the last of two sequential assignments to the same variable', async () => {
        // Setup
        let fileContents = [];
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const bpmnPath = path.join(__dirname, "../resources", "double-variable-assignment.bpmn");

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
            filename: 'double-variable-assignment.bpmn',
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

        // The workflow (age23 script task -> age25 script task -> end) runs
        // fire-and-forget after /start responds, so poll for the "age"
        // variable to show up rather than asserting immediately.
        const variable = await waitForVariable(procData.id, 'age', TEST_TIMEOUT - 5000);

        // If the second assignment didn't overwrite the first (e.g. a stale
        // read/write race, or the upsert key not matching), this would either
        // still read 23, or the unique (processInstance, name) constraint
        // would have failed the second write outright.
        expect(variable).toBeDefined();
        expect(variable.value).toBe('25');

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

    // Polls the Variable table until the given variable shows up (or the
    // timeout elapses), since the workflow runs asynchronously after /start
    // responds.
    async function waitForVariable(processInstanceId, name, timeoutMs) {
        const pollIntervalMs = 250;
        const deadline = Date.now() + timeoutMs;
        let variable = null;
        while (Date.now() < deadline) {
            variable = await PersistenceModule.findOne("Variable", {
                processInstance: processInstanceId,
                name: name
            });
            if (variable && variable.value === '25') {
                return variable;
            }
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
        return variable;
    }

});
