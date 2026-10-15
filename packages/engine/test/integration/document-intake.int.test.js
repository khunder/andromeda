import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {fileURLToPath} from "url";
import {EmbeddedContainerService} from "../../src/modules/engine/embedded/embedded.containers.service.js";
import PersistenceModule from "../../src/modules/persistence/persistence.module.js";

import { it, expect, describe, beforeAll, afterAll } from 'vitest';

// The document-intake example (test/resources/document-intake.bpmn, also in
// the designer's Examples): file variables end to end - a file passed to
// /start, inspected by a script through its reference, routed by a gateway,
// and a second file delivered to a human task through /signal.
describe('DocumentIntake::Integration', () => {
    const TEST_TIMEOUT = 45000;
    const deploymentId = "cov/document_intake";
    let testPort;
    let ctx;
    let baseUrl;

    beforeAll(async () => {
        try {
            await PersistenceModule.init();
        } catch (e) {
            console.log('PersistenceModule init error (may already be initialized):', e.message);
        }
        testPort = await findAvailablePort();

        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const bpmnXml = fs.readFileSync(path.join(__dirname, "../resources", "document-intake.bpmn"), {encoding: 'utf8'});
        ctx = await Utils.prepareContainerContext([bpmnXml], deploymentId);
        ctx.includeGalaxyModule = true;
        await new EngineService().generateContainer(ctx);
        await EmbeddedContainerService.startEmbeddedContainer(ctx.deploymentId, {port: testPort});
        baseUrl = `http://127.0.0.1:${testPort}/DocumentIntake`;
    }, TEST_TIMEOUT);

    afterAll(async () => {
        try {
            await EmbeddedContainerService.stopEmbeddedContainer(ctx?.deploymentId || deploymentId, testPort);
        } catch (e) {
            // already stopped
        }
        try {
            const deploymentPath = path.join(process.cwd(), 'deployments', ctx?.deploymentId || deploymentId);
            fs.rmSync(deploymentPath, {recursive: true, force: true});
        } catch (e) {
            // Windows may still hold the stopped container's files for a moment
            console.error('Cleanup error:', e.message);
        }
    });

    it('accepts a PDF, waits for the signed copy at the human task, then archives both', async () => {
        const pdf = Buffer.from('%PDF-1.7 a contract');
        const start = await fetch(`${baseUrl}/start`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({files: {document: {base64: pdf.toString('base64'), fileName: 'contract.pdf', contentType: 'application/pdf'}}}),
        });
        expect(start.status).toBe(200);
        const {id} = await start.json();

        // the script and gateway run after /start answers - wait for the task
        const task = await waitFor(async () => {
            const tasks = await (await fetch(`${baseUrl}/tasks`)).json();
            return tasks.find((t) => t.processInstanceId === id);
        }, TEST_TIMEOUT - 25000);
        expect(task.nodeId).toBe('SignDocument');

        expect(await variable(id, 'category')).toBe('pdf');
        expect(await variable(id, 'accepted')).toBe('true');
        expect(await variable(id, 'summary')).toMatch(/^contract\.pdf - application\/pdf, 19 bytes, kept in database storage, sha256 [0-9a-f]{12}$/);

        // the variable holds a reference with the hash - never the content
        const document = JSON.parse(await variable(id, 'document'));
        expect(document).toMatchObject({kind: 'file', fileName: 'contract.pdf', size: pdf.length, nodeId: 'StartEvent_Received'});
        expect(document.sha256).toBe(crypto.createHash('sha256').update(pdf).digest('hex'));
        expect(JSON.stringify(document)).not.toContain(pdf.toString('base64'));

        const signed = Buffer.from('%PDF-1.7 a contract, signed');
        const signal = await fetch(`${baseUrl}/signal`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({
                processInstanceId: id,
                nodeId: 'SignDocument',
                files: {signedCopy: {base64: signed.toString('base64'), fileName: 'contract-signed.pdf', contentType: 'application/pdf'}},
            }),
        });
        expect(signal.status).toBe(200);

        const instance = await waitFor(async () => {
            const row = await PersistenceModule.findOne("ProcessInstance", {_id: id});
            return row?.status === 1 ? row : null;
        }, TEST_TIMEOUT - 25000);
        expect(instance.status).toBe(1);
        expect(await variable(id, 'outcome')).toBe(`archived contract.pdf with signed copy contract-signed.pdf (${signed.length} bytes, received at SignDocument)`);
    }, TEST_TIMEOUT);

    it('rejects a document that is neither a PDF nor an image', async () => {
        const start = await fetch(`${baseUrl}/start`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({files: {document: {base64: Buffer.from('a,b\n1,2\n').toString('base64'), fileName: 'data.csv', contentType: 'text/csv'}}}),
        });
        expect(start.status).toBe(200);
        const {id} = await start.json();

        const instance = await waitFor(async () => {
            const row = await PersistenceModule.findOne("ProcessInstance", {_id: id});
            return row?.status === 1 ? row : null;
        }, TEST_TIMEOUT - 25000);
        expect(instance.status).toBe(1);
        expect(await variable(id, 'category')).toBe('other');
        expect(await variable(id, 'outcome')).toMatch(/^rejected: other documents are not accepted \(data\.csv - text\/csv, 8 bytes/);
    }, TEST_TIMEOUT);

    async function variable(processInstanceId, name) {
        const row = await PersistenceModule.findOne("Variable", {processInstance: processInstanceId, name});
        return row?.value;
    }

    async function waitFor(check, timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        let result = null;
        while (Date.now() < deadline) {
            result = await check();
            if (result) return result;
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
        return result;
    }

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
});
