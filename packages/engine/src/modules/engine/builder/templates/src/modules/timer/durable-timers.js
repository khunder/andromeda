/**
 * durable-timers.js — durable, highly available timers for a process engine.
 * Vendored (ESM syntax, and trimmed to just TimerService/parseIso - the
 * database-specific Store implementations the original ships are replaced
 * here by EngineTimerRepository, which plugs into this same six-method
 * Store contract on top of this project's existing dual-driver persistence
 * layer instead) from the standalone module of the same name. See that
 * original for the full Postgres/MySQL/SQLite/MongoDB Store reference
 * implementations and its test suite.
 *
 * Every pending timer is a row. All container replicas poll for due rows
 * and claim them with an atomic lease, so each firing has exactly one
 * winner. The winner's handler runs alongside the same update that
 * reschedules or deletes the timer (see EngineTimerRepository for exactly
 * what "alongside" guarantees on this project's drivers). A crashed
 * instance's lease expires and another instance takes over.
 *
 * Usage:
 *   const timers = new TimerService({ store });
 *
 *   timers.on('start-event', async ({ payload, scheduledAt }, tx) => {
 *     ...
 *   });
 *
 *   await timers.start();
 *
 *   // A fixed id makes this safe to call from every instance at boot/deploy:
 *   // only the first insert creates the timer.
 *   await timers.schedule({
 *     id: 'start:order-process',
 *     type: 'start-event',
 *     iso: 'R/PT10S',                      // timeCycle; also 'PT5M', 'R3/PT10S', a date
 *     payload: { definition: 'order-process' },
 *   });
 *
 * Store contract (implement these six methods to support another database):
 *   init()
 *   insert(timer, tx?)                       -> boolean (false if the id exists)
 *   remove(id, tx?)
 *   claimDue(now, owner, leaseMs, limit)     -> timers[]
 *   settle(timer, owner, next, work)         -> boolean (false if the lease was lost)
 *   fail(timer, owner, { attempts, error, retryAt })
 */

import os from 'node:os';
import {randomUUID} from 'node:crypto';

// ---------------------------------------------------------------------------
// ISO 8601 timer expressions (BPMN timeDate / timeDuration / timeCycle)
// ---------------------------------------------------------------------------

const DURATION = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

function parseDuration(str) {
  const m = DURATION.exec(str);
  if (!m || str === 'P' || str.endsWith('T')) {
    // Years and months are rejected on purpose: their length depends on the calendar.
    throw new Error(`unsupported ISO 8601 duration "${str}" (use W, D, H, M, S)`);
  }
  const [, w = 0, d = 0, h = 0, min = 0, s = 0] = m;
  return Math.round((((+w * 7 + +d) * 24 + +h) * 3600 + +min * 60 + +s) * 1000);
}

function parseDate(str) {
  const t = Date.parse(str);
  if (Number.isNaN(t)) throw new Error(`invalid date "${str}"`);
  return t;
}

/**
 * 'PT5M'                          -> { afterMs }
 * '2026-12-01T09:00:00Z'          -> { at }
 * 'R/PT10S' or 'R3/PT10S'         -> { everyMs, times }   (times null = forever)
 * 'R3/2026-12-01T09:00:00Z/PT10S' -> { everyMs, times, at }
 */
export function parseIso(str) {
  const parts = String(str).trim().split('/');
  if (/^R\d*$/.test(parts[0])) {
    if (parts.length < 2 || parts.length > 3) throw new Error(`unsupported timer "${str}"`);
    const out = {
      everyMs: parseDuration(parts[parts.length - 1]),
      times: parts[0].length > 1 ? Number(parts[0].slice(1)) : null,
    };
    if (parts.length === 3) out.at = parseDate(parts[1]);
    return out;
  }
  if (parts.length !== 1) throw new Error(`unsupported timer "${str}"`);
  return parts[0].startsWith('P') ? {afterMs: parseDuration(parts[0])} : {at: parseDate(parts[0])};
}

// ---------------------------------------------------------------------------
// TimerService
// ---------------------------------------------------------------------------

export class TimerService {
  /**
   * pollMs      how often to look for due timers (timers fire up to this late)
   * leaseMs     how long a claim lasts; a crashed instance's timers are retried after this
   * batch       max timers fired concurrently per instance (each holds one connection)
   * maxAttempts failures before a timer is parked (due_at = NULL) for manual attention
   * backoffMs   first retry delay; doubles on each further failure
   * misfire     for cycles that fell behind: 'skip' fires once and jumps to the
   *             next future slot; 'catchup' fires every missed slot
   */
  constructor({
    store, instanceId, onError,
    pollMs = 1000, leaseMs = 30_000, batch = 5,
    maxAttempts = 3, backoffMs = 5000, misfire = 'skip',
  } = {}) {
    if (!store) throw new Error('TimerService: a store is required');
    this.store = store;
    this.instanceId = instanceId || `${os.hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
    this.onError = onError || ((err, ctx) => console.error('[timers]', ctx, err));
    Object.assign(this, {pollMs, leaseMs, batch, maxAttempts, backoffMs, misfire});
    this.handlers = new Map();
    this.running = false;
  }

  /** Register the handler for a timer type: async (timer, tx) => {} */
  on(type, handler) {
    this.handlers.set(type, handler);
    return this;
  }

  /**
   * Create a timer. Pass `tx` to create it atomically with your own writes
   * (e.g. a token arriving at an intermediate timer event).
   *
   *   { type, payload?, id?, iso }                  ISO 8601 expression, or:
   *   { type, payload?, id?, at }                   fire at a Date / epoch ms
   *   { type, payload?, id?, afterMs }              fire after a delay
   *   { type, payload?, id?, everyMs, times?, at? } repeat; first fire at `at`
   *                                                 or after one interval
   * Returns { id, created }. created is false when the id already exists.
   */
  async schedule(spec, tx) {
    const s = spec.iso ? {...spec, ...parseIso(spec.iso)} : spec;
    if (!s.type) throw new Error('schedule: type is required');
    const everyMs = s.everyMs ?? null;
    if (everyMs !== null && !(everyMs >= 1000)) throw new Error('schedule: everyMs must be >= 1000');
    const times = everyMs === null ? null : s.times ?? null;
    if (times !== null && !(times >= 1)) throw new Error('schedule: times must be >= 1');
    const dueAt = s.at != null ? +new Date(s.at) : Date.now() + (s.afterMs ?? everyMs ?? 0);
    if (!Number.isFinite(dueAt)) throw new Error('schedule: invalid fire time');

    const timer = {id: s.id || randomUUID(), type: s.type, payload: s.payload ?? null, dueAt, everyMs, remaining: times};
    const created = await this.store.insert(timer, tx);
    return {id: timer.id, created};
  }

  /** Delete a timer (boundary event cancelled, process undeployed, ...). */
  cancel(id, tx) {
    return this.store.remove(id, tx);
  }

  async start() {
    if (this.running) return;
    await this.store.init();
    this.running = true;
    this._loopDone = this._loop();
  }

  /** Stops polling and resolves once in-flight timers have finished. */
  stop() {
    this.running = false;
    clearTimeout(this._sleepTimer);
    if (this._wake) this._wake();
    return this._loopDone;
  }

  async _loop() {
    while (this.running) {
      let claimed = 0;
      try {
        const timers = await this.store.claimDue(Date.now(), this.instanceId, this.leaseMs, this.batch);
        claimed = timers.length;
        await Promise.all(timers.map((t) => this._fire(t)));
      } catch (err) {
        this.onError(err, {phase: 'poll'});
      }
      // A full batch means there is probably more work: poll again right away.
      // Jitter keeps instances from polling in lockstep.
      if (this.running && claimed < this.batch) {
        await new Promise((resolve) => {
          this._wake = resolve;
          this._sleepTimer = setTimeout(resolve, this.pollMs * (0.75 + Math.random() * 0.5));
        });
      }
    }
  }

  async _fire(timer) {
    const handler = this.handlers.get(timer.type);
    try {
      if (!handler) {
        throw Object.assign(new Error(`no handler registered for timer type "${timer.type}"`), {noHandler: true});
      }
      const view = {
        id: timer.id,
        type: timer.type,
        payload: timer.payload,
        scheduledAt: new Date(timer.dueAt),
        attempts: timer.attempts,
      };
      await this.store.settle(timer, this.instanceId, this._next(timer), (tx) => handler(view, tx));
    } catch (err) {
      // The transaction rolled back, so nothing the handler wrote through `tx` survived.
      // A missing handler (e.g. mid rolling deploy) is retried without using up an attempt.
      const attempts = err.noHandler ? timer.attempts : timer.attempts + 1;
      const parked = attempts >= this.maxAttempts;
      const retryAt = parked ? null : Date.now() + this.backoffMs * 2 ** Math.max(attempts - 1, 0);
      this.onError(err, {phase: 'fire', timer: timer.id, type: timer.type, attempts, parked});
      try {
        await this.store.fail(timer, this.instanceId, {attempts, error: String(err.message || err), retryAt});
      } catch (failErr) {
        this.onError(failErr, {phase: 'fail', timer: timer.id});
      }
    }
  }

  // Where the timer goes after a successful fire: null = delete it.
  // Cycles advance from the nominal time, not from "now", so they never drift.
  _next(timer) {
    if (!timer.everyMs) return null;
    if (timer.remaining !== null && timer.remaining <= 1) return null;
    const now = Date.now();
    let dueAt = timer.dueAt + timer.everyMs;
    if (dueAt <= now && this.misfire === 'skip') {
      dueAt += Math.ceil((now - dueAt + 1) / timer.everyMs) * timer.everyMs;
    }
    return {dueAt, remaining: timer.remaining === null ? null : timer.remaining - 1};
  }
}

export default TimerService;
