import PersistenceModule from "../../src/modules/persistence/persistence.module.js";
import {PersistenceGateway} from "../../src/modules/persistence/persistence-gateway.js";
import {v4} from "uuid";

import {it, expect, describe, beforeAll} from 'vitest';

// This is the deterministic proof of the HA dedupe mechanism behind Timer
// Start Event (see timer.service.js / TimerTickRepository): every container
// replica running the same deployment races to claim the same
// (deploymentId, processDef, nodeId, tickKey) via PersistenceGateway.
// claimTimerTick(), and the unique index backing it guarantees only one
// caller ever gets `true`. A real two-container race (spawning two embedded
// containers against the same deployment) would exercise this same code
// path end-to-end, but its outcome is only reliably atomic under MongoDB -
// this repo's sqlite driver (sql.js) explicitly documents best-effort,
// non-atomic multi-process file coordination, so a cross-process race test
// would be flaky under the sqlite driver the test suite runs against by
// default. This test instead calls the exact same claim primitive directly,
// which is atomic within a single process regardless of driver.
describe('TimerTickClaim::Integration', () => {
    const TEST_TIMEOUT = 30000;

    beforeAll(async () => {
        try {
            await PersistenceModule.init();
        } catch (e) {
            console.log('PersistenceModule init error (may already be initialized):', e.message);
        }
    }, TEST_TIMEOUT);

    it('lets exactly one caller claim a given tick, and rejects every later duplicate attempt', async () => {
        const deploymentId = `cov/timer_tick_claim_${v4()}`;
        const processDef = 'TimerTickClaimTest';
        const nodeId = 'StartEvent_1';
        const tickKey = new Date().toISOString().slice(0, 16);

        const firstClaim = await PersistenceGateway.claimTimerTick({deploymentId, processDef, nodeId, tickKey});
        expect(firstClaim).toBe(true);

        const secondClaim = await PersistenceGateway.claimTimerTick({deploymentId, processDef, nodeId, tickKey});
        expect(secondClaim).toBe(false);

        // simulates a second container replica racing the exact same tick -
        // same call, same result: still rejected
        const thirdClaim = await PersistenceGateway.claimTimerTick({deploymentId, processDef, nodeId, tickKey});
        expect(thirdClaim).toBe(false);
    }, TEST_TIMEOUT);

    it('treats a different tickKey (the next cron fire) as independently claimable', async () => {
        const deploymentId = `cov/timer_tick_claim_${v4()}`;
        const processDef = 'TimerTickClaimTest';
        const nodeId = 'StartEvent_1';

        const claimTick1 = await PersistenceGateway.claimTimerTick({deploymentId, processDef, nodeId, tickKey: '2026-01-01T00:00'});
        expect(claimTick1).toBe(true);

        const claimTick2 = await PersistenceGateway.claimTimerTick({deploymentId, processDef, nodeId, tickKey: '2026-01-01T00:01'});
        expect(claimTick2).toBe(true);

        // re-claiming tick1 after tick2 was claimed still fails - uniqueness
        // is per (deploymentId, processDef, nodeId, tickKey), not just "most recent"
        const reclaimTick1 = await PersistenceGateway.claimTimerTick({deploymentId, processDef, nodeId, tickKey: '2026-01-01T00:00'});
        expect(reclaimTick1).toBe(false);
    }, TEST_TIMEOUT);

    it('treats different nodeIds under the same deployment/processDef/tickKey as independently claimable', async () => {
        const deploymentId = `cov/timer_tick_claim_${v4()}`;
        const processDef = 'TimerTickClaimTest';
        const tickKey = new Date().toISOString().slice(0, 16);

        const claimNodeA = await PersistenceGateway.claimTimerTick({deploymentId, processDef, nodeId: 'StartEvent_A', tickKey});
        expect(claimNodeA).toBe(true);

        const claimNodeB = await PersistenceGateway.claimTimerTick({deploymentId, processDef, nodeId: 'StartEvent_B', tickKey});
        expect(claimNodeB).toBe(true);
    }, TEST_TIMEOUT);
});
