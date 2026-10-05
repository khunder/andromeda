import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TimerService} from './durable-timers.js';

// in-memory Store honouring the same contract as EngineTimerRepository,
// recording when claimDue() is called so polling cadence can be asserted
function createStore() {
    const rows = new Map();
    const polls = [];
    return {
        rows,
        polls,
        async init() {},
        async insert(timer) {
            if (rows.has(timer.id)) return false;
            rows.set(timer.id, {...timer, attempts: 0, lockedUntil: null});
            return true;
        },
        async remove(id) {
            rows.delete(id);
        },
        async claimDue(now, owner, leaseMs, limit) {
            polls.push(now);
            const due = [...rows.values()]
                .filter((r) => r.dueAt !== null && r.dueAt <= now && (r.lockedUntil === null || r.lockedUntil < now))
                .slice(0, limit);
            due.forEach((r) => { r.lockedUntil = now + leaseMs; });
            return due.map((r) => ({...r}));
        },
        async settle(timer, owner, next, work) {
            await work(undefined);
            if (next) {
                Object.assign(rows.get(timer.id), next, {lockedUntil: null});
            } else {
                rows.delete(timer.id);
            }
        },
        async fail(timer, owner, {attempts, retryAt}) {
            Object.assign(rows.get(timer.id), {attempts, dueAt: retryAt, lockedUntil: null});
        },
    };
}

// gaps between consecutive polls, rounded to whole seconds
const gaps = (polls) => polls.slice(1).map((t, i) => Math.round((t - polls[i]) / 1000));

describe('TimerService adaptive polling', () => {
    let store;
    let timers;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        // no jitter, so the cadence is exact
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        store = createStore();
        timers = new TimerService({store, pollMs: 1000, maxPollMs: 8000});
    });

    afterEach(async () => {
        const stopped = timers.stop();
        await vi.runOnlyPendingTimersAsync();
        await stopped;
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('backs off exponentially while idle, capped at maxPollMs', async () => {
        await timers.start();
        await vi.advanceTimersByTimeAsync(40_000);

        expect(gaps(store.polls).slice(0, 6)).toEqual([1, 2, 4, 8, 8, 8]);
    });

    it('fires a locally scheduled timer on time even while backed off', async () => {
        const fired = [];
        timers.on('t', (timer) => { fired.push(Date.now() - timer.scheduledAt.getTime()); });
        await timers.start();
        await vi.advanceTimersByTimeAsync(10_000); // backed off to the 8s ceiling

        await timers.schedule({type: 't', afterMs: 1500});
        await vi.advanceTimersByTimeAsync(1500);

        expect(fired).toEqual([0]);
    });

    it('drops back to the fast interval after claiming work', async () => {
        timers.on('t', () => {});
        await timers.start();
        await vi.advanceTimersByTimeAsync(20_000);

        await timers.schedule({type: 't', afterMs: 0});
        const before = store.polls.length;
        await vi.advanceTimersByTimeAsync(5000);
        const afterWork = store.polls.slice(before);

        expect(store.rows.size).toBe(0);
        // claim poll, 1s after the work, then the backoff restarts from pollMs
        expect(gaps(afterWork)).toEqual([1, 1, 2]);
    });

    it('rejects a maxPollMs below pollMs', () => {
        expect(() => new TimerService({store, pollMs: 5000, maxPollMs: 1000})).toThrow(/maxPollMs/);
    });
});
