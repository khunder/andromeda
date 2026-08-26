import PersistenceModule from "../../src/modules/persistence/persistence.module.js";
import {PersistenceGateway} from "../../src/modules/persistence/persistence-gateway.js";
import {v4} from "uuid";

import {it, expect, describe, beforeAll} from 'vitest';

// Proof of the container-registration mechanism (see ContainerService's
// heartbeat loop / ContainerRegistrationRepository): every running container
// replica periodically upserts its own row keyed by
// (deploymentId, version, containerId), so concurrent replicas of the same
// deployment/version never collide on the same row, and liveness is a plain
// query for rows whose lastHeartbeat is still within the expected window.
describe('ContainerRegistration::Integration', () => {
    const TEST_TIMEOUT = 30000;

    beforeAll(async () => {
        try {
            await PersistenceModule.init();
        } catch (e) {
            console.log('PersistenceModule init error (may already be initialized):', e.message);
        }
    }, TEST_TIMEOUT);

    it('repeated heartbeats from the same container update one row instead of creating duplicates', async () => {
        const deploymentId = `cov/container_registration_${v4()}`;
        const version = '1.0';
        const containerId = v4();

        await PersistenceGateway.registerContainerHeartbeat({deploymentId, version, containerId});
        const firstBeat = await PersistenceGateway.findRunningContainers({deploymentId, version, maxAgeMs: 60_000});
        expect(firstBeat).toHaveLength(1);
        const firstHeartbeatAt = new Date(firstBeat[0].lastHeartbeat).getTime();

        await new Promise(resolve => setTimeout(resolve, 10));
        await PersistenceGateway.registerContainerHeartbeat({deploymentId, version, containerId});

        const secondBeat = await PersistenceGateway.findRunningContainers({deploymentId, version, maxAgeMs: 60_000});
        expect(secondBeat).toHaveLength(1);
        expect(new Date(secondBeat[0].lastHeartbeat).getTime()).toBeGreaterThanOrEqual(firstHeartbeatAt);
    }, TEST_TIMEOUT);

    it('treats different containerIds under the same deployment/version as independent rows', async () => {
        const deploymentId = `cov/container_registration_${v4()}`;
        const version = '1.0';
        const containerA = v4();
        const containerB = v4();

        await PersistenceGateway.registerContainerHeartbeat({deploymentId, version, containerId: containerA});
        await PersistenceGateway.registerContainerHeartbeat({deploymentId, version, containerId: containerB});

        const running = await PersistenceGateway.findRunningContainers({deploymentId, version, maxAgeMs: 60_000});
        expect(running).toHaveLength(2);
        const containerIds = running.map(r => r.containerId).sort();
        expect(containerIds).toEqual([containerA, containerB].sort());
    }, TEST_TIMEOUT);

    it('treats different versions under the same deployment as independent rows', async () => {
        const deploymentId = `cov/container_registration_${v4()}`;
        const containerId = v4();

        await PersistenceGateway.registerContainerHeartbeat({deploymentId, version: '1.0', containerId});
        await PersistenceGateway.registerContainerHeartbeat({deploymentId, version: '2.0', containerId});

        const runningV1 = await PersistenceGateway.findRunningContainers({deploymentId, version: '1.0', maxAgeMs: 60_000});
        expect(runningV1).toHaveLength(1);

        const runningAll = await PersistenceGateway.findRunningContainers({deploymentId, maxAgeMs: 60_000});
        expect(runningAll).toHaveLength(2);
    }, TEST_TIMEOUT);

    it('excludes rows whose last heartbeat is older than maxAgeMs', async () => {
        const deploymentId = `cov/container_registration_${v4()}`;
        const version = '1.0';
        const containerId = v4();

        await PersistenceGateway.registerContainerHeartbeat({deploymentId, version, containerId});

        const staleWindow = await PersistenceGateway.findRunningContainers({deploymentId, version, maxAgeMs: -1});
        expect(staleWindow).toHaveLength(0);

        const freshWindow = await PersistenceGateway.findRunningContainers({deploymentId, version, maxAgeMs: 60_000});
        expect(freshWindow).toHaveLength(1);
    }, TEST_TIMEOUT);
});
