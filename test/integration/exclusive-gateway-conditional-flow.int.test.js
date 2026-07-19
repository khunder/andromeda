import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {EmbeddedContainerService} from "../../src/modules/engine/embedded/embedded.containers.service.js";
import FormData from "form-data";
import PersistenceModule from "../../src/modules/persistence/persistence.module.js";

import { it, expect, describe, beforeAll, afterAll } from 'vitest';

describe('ExclusiveGatewayConditionalFlow::Integration', () => {
    const TEST_TIMEOUT = 30000; // 30 seconds timeout for integration test
    let deploymentId = "cov/exclusive_gateway_conditional_flow";
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

    it('takes only the outgoing flow whose condition is true (age=20 -> adult branch)', async () => {
        // Setup
        let fileContents = [];
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const bpmnPath = path.join(__dirname, "../resources", "exclusive-gateway-conditional-flow.bpmn");

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
            filename: 'exclusive-gateway-conditional-flow.bpmn',
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

        // The workflow (SetAge -> exclusive gateway -> one of two end events)
        // runs fire-and-forget after /start responds, so poll for the adult
        // branch's flow event rather than asserting immediately.
        const adultFlowCount = await waitForFlowEventCount(procData.id, 'Flow_Adult', 1, TEST_TIMEOUT - 5000);

        // age=20 >= 18, so Flow_Adult's condition is true and Flow_Minor's is
        // false: the adult branch must fire exactly once, and the minor
        // branch (whose condition evaluated false) must never fire at all.
        expect(adultFlowCount).toBe(1);
        const minorFlowCount = await PersistenceModule.countDocuments("FlowEvent", {
            processInstance: procData.id,
            flowId: 'Flow_Minor'
        });
        expect(minorFlowCount).toBe(0);

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

    // Polls the FlowEvent table until the given flow reaches the expected
    // count (or the timeout elapses), since the workflow runs asynchronously
    // after /start responds.
    async function waitForFlowEventCount(processInstanceId, flowId, expectedCount, timeoutMs) {
        const pollIntervalMs = 250;
        const deadline = Date.now() + timeoutMs;
        let count = 0;
        while (Date.now() < deadline) {
            count = await PersistenceModule.countDocuments("FlowEvent", {
                processInstance: processInstanceId,
                flowId: flowId
            });
            if (count >= expectedCount) {
                return count;
            }
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
        return count;
    }

});
