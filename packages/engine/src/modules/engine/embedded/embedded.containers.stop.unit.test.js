import {afterEach, describe, expect, it, vi} from 'vitest';

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

    it('needs a port', async () => {
        await expect(EmbeddedContainerService.stopEmbeddedContainer('orders_1_0_0')).rejects.toThrow(/port/);
    });
});
