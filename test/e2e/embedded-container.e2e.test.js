import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from "mongoose";
import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { EmbeddedContainerService } from "../../src/modules/engine/embedded/embedded.containers.service.js";

describe('start/Stop Embedded container', () => {
    // Increase timeout for e2e tests
    const E2E_TIMEOUT = 30000;

    beforeAll(async () => {
        // Ensure MongoDB connection is ready if needed
        if (process.env.MONGODB_URI && mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }
    });

    afterAll(async () => {
        // Clean up MongoDB connection if needed
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });

    it('Start/Stop Embedded container', async () => {
        const deploymentId = "test";
        const fileContents = [];
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        
        // Read the BPMN file
        const bpmnPath = path.join(__dirname, "..", "resources", "andromeda.bpmn");
        expect(fs.existsSync(bpmnPath), `BPMN file not found at ${bpmnPath}`).toBe(true);
        fileContents.push(fs.readFileSync(bpmnPath, { encoding: 'utf8' }));

        // Prepare container context
        const ctx = await Utils.prepareContainerContext(fileContents, deploymentId);
        expect(ctx).toBeDefined();
        expect(ctx.deploymentId).toBe(deploymentId);
        
        // Generate container
        const engineService = new EngineService();
        await engineService.generateContainer(ctx);
        
        // Start embedded container
        await EmbeddedContainerService.startEmbeddedContainer(deploymentId, { port: 10000 });
        // The container should be started - we can verify this by checking logs or process
        
        // Stop embedded container
        await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, 10000);
        // The container should be stopped - stopEmbeddedContainer may not return a value
    }, E2E_TIMEOUT);
});
