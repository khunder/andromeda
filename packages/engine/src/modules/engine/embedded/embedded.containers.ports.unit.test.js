import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import net from 'net';

vi.mock('forever', () => ({default: {kill: vi.fn(), start: vi.fn()}}));

const {EmbeddedContainerService} = await import('./embedded.containers.service.js');
const {EmbeddedContainerModel} = await import('./embedded.container.model.js');

// a range unlikely to be used on a dev machine, so the tests don't collide with real containers
const OFFSET = 47310;

const listen = (port, host) => new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
});
const close = (server) => new Promise((resolve) => server.close(resolve));

describe('container port allocation', () => {
    let savedOffset;
    beforeEach(() => {
        savedOffset = EmbeddedContainerService.portOffset;
        EmbeddedContainerService.portOffset = OFFSET;
        EmbeddedContainerService.maxAttemptsRange = 10;
        EmbeddedContainerService.allocatedPorts = [];
        EmbeddedContainerService.containers = [];
    });
    afterEach(() => {
        EmbeddedContainerService.portOffset = savedOffset;
        EmbeddedContainerService.maxAttemptsRange = 100;
        EmbeddedContainerService.allocatedPorts = [];
        EmbeddedContainerService.containers = [];
    });

    it('allocates from the offset up, skipping reserved ports', async () => {
        expect(await EmbeddedContainerService.AllocatePortInRange()).toBe(OFFSET);
        expect(await EmbeddedContainerService.AllocatePortInRange()).toBe(OFFSET + 1);
        expect(await EmbeddedContainerService.AllocatePortInRange()).toBe(OFFSET + 2);
    });

    it('reuses the port of a stopped container - the lowest free one first', async () => {
        for (let i = 0; i < 3; i++) {
            const port = await EmbeddedContainerService.AllocatePortInRange();
            EmbeddedContainerService.containers.push({deploymentId: 'orders_1_0_0', model: new EmbeddedContainerModel(100 + i, port, 'orders_1_0_0')});
        }
        // the designer sends the port as a string
        await EmbeddedContainerService.stopEmbeddedContainer('orders_1_0_0', String(OFFSET + 1));
        expect(EmbeddedContainerService.allocatedPorts).not.toContain(OFFSET + 1);
        expect(await EmbeddedContainerService.AllocatePortInRange()).toBe(OFFSET + 1);
        expect(await EmbeddedContainerService.AllocatePortInRange()).toBe(OFFSET + 3);
    });

    it('skips a port another program holds on 127.0.0.1, without reserving it', async () => {
        const busy = await listen(OFFSET, '127.0.0.1');
        try {
            expect(await EmbeddedContainerService.isPortFree(OFFSET)).toBe(false);
            expect(await EmbeddedContainerService.AllocatePortInRange()).toBe(OFFSET + 1);
            expect(EmbeddedContainerService.allocatedPorts).not.toContain(OFFSET);
        } finally {
            await close(busy);
        }
        // once it's released by the other program, it's used again
        expect(await EmbeddedContainerService.AllocatePortInRange()).toBe(OFFSET);
    });

    it('does not hand the same port to two containers started at the same time', async () => {
        const ports = await Promise.all([1, 2, 3].map(() => EmbeddedContainerService.AllocatePortInRange()));
        expect(new Set(ports).size).toBe(3);
    });

    it('reserves an explicitly requested port', async () => {
        expect(await EmbeddedContainerService.allocatePort({port: OFFSET})).toBe(OFFSET);
        expect(await EmbeddedContainerService.AllocatePortInRange()).toBe(OFFSET + 1);
    });

    it('fails when the whole range is taken', async () => {
        EmbeddedContainerService.maxAttemptsRange = 2;
        await EmbeddedContainerService.AllocatePortInRange();
        await EmbeddedContainerService.AllocatePortInRange();
        await expect(EmbeddedContainerService.AllocatePortInRange()).rejects.toBe(`cannot allocate port ${OFFSET} after 2 attempts`);
    });
});
