import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import fs from 'fs';
import http from 'http';
import path from 'path';

vi.mock('forever', () => ({default: {kill: vi.fn(), start: vi.fn()}}));

const forever = (await import('forever')).default;
const {EmbeddedContainerService} = await import('./embedded.containers.service.js');
const {EmbeddedContainerModel} = await import('./embedded.container.model.js');

const add = (deploymentId, pid, port) =>
    EmbeddedContainerService.containers.push({deploymentId, model: new EmbeddedContainerModel(pid, port, deploymentId)});

describe('stopEmbeddedContainer', () => {
    afterEach(() => {
        EmbeddedContainerService.containers = [];
        forever.kill.mockClear();
    });

    it('stops only the container on the given port when a deployment runs several', async () => {
        add('orders_1_0_0', 101, 10001);
        add('orders_1_0_0', 102, 10002);
        add('billing_1_0_0', 201, 10003);

        // the port comes from the HTTP body as a string
        await EmbeddedContainerService.stopEmbeddedContainer('orders_1_0_0', '10001');

        expect(forever.kill).toHaveBeenCalledTimes(1);
        expect(forever.kill).toHaveBeenCalledWith(101);
        expect(EmbeddedContainerService.containers.map((e) => e.model.pid)).toEqual([102, 201]);
    });

    it('does nothing for a port the deployment does not run on', async () => {
        add('orders_1_0_0', 101, 10001);
        await EmbeddedContainerService.stopEmbeddedContainer('orders_1_0_0', 10009);
        expect(forever.kill).not.toHaveBeenCalled();
        expect(EmbeddedContainerService.containers).toHaveLength(1);
    });

    describe('a container this engine did not start (outlived an engine restart)', () => {
        const deploymentId = 'zz-orphan-test_1_0_0';
        const dir = path.join(process.cwd(), 'deployments', deploymentId);
        let server;
        let port;
        let reply;

        beforeEach(async () => {
            server = http.createServer((req, res) => {
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify(req.url === '/api/containers' ? reply : {}));
            });
            await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
            port = server.address().port;
            fs.mkdirSync(dir, {recursive: true});
            fs.writeFileSync(path.join(dir, `.pid_${port}`), '424242');
        });
        afterEach(async () => {
            await new Promise((resolve) => server.close(resolve));
            fs.rmSync(dir, {recursive: true, force: true});
        });

        it('stops it by its pid file once the container on the port confirms it', async () => {
            reply = {deploymentId, pid: 424242};
            expect(await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, String(port))).toBe(true);
            expect(forever.kill).toHaveBeenCalledWith(424242);
            expect(fs.existsSync(path.join(dir, `.pid_${port}`))).toBe(false);
        });

        it('accepts containers that do not report their pid (compiled before)', async () => {
            reply = {deploymentId};
            expect(await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, port)).toBe(true);
            expect(forever.kill).toHaveBeenCalledWith(424242);
        });

        it.each([
            ['another deployment answers on the port', () => ({deploymentId: 'other_1_0_0', pid: 424242})],
            ['the pid file is stale (another pid answers)', () => ({deploymentId, pid: 999})],
        ])('kills nothing when %s', async (label, makeReply) => {
            reply = makeReply();
            expect(await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, port)).toBe(false);
            expect(forever.kill).not.toHaveBeenCalled();
        });

        it('kills nothing without a pid file', async () => {
            reply = {deploymentId, pid: 424242};
            fs.rmSync(path.join(dir, `.pid_${port}`));
            expect(await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, port)).toBe(false);
            expect(forever.kill).not.toHaveBeenCalled();
        });
    });

    it('needs a port', async () => {
        await expect(EmbeddedContainerService.stopEmbeddedContainer('orders_1_0_0')).rejects.toThrow(/port/);
    });
});
