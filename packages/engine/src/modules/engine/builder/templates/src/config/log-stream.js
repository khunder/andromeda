/**
 * LogStream - an in-process pino destination that turns every log line into
 * a live event for SSE subscribers (GET /api/logs/stream, see
 * src/modules/web/log-stream.routes.js).
 *
 * pino transports run in a worker thread, so they can't reach subscribers
 * living in this process - LogStream is plugged into pino.multistream
 * instead (see pino.config.js), next to the pretty console and file streams.
 * Nothing is read back from the log file: subscribers get the lines as pino
 * writes them, plus a bounded in-memory backlog so a client connecting (or
 * reconnecting with Last-Event-ID) catches up on recent history.
 *
 * The engine's src/config/log-stream.js and the generated containers' copy
 * (src/modules/engine/builder/templates/src/config/log-stream.js) are kept
 * identical.
 */

export const LEVEL_VALUES = {trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60};
const LEVEL_LABELS = Object.fromEntries(Object.entries(LEVEL_VALUES).map(([label, value]) => [value, label]));

export class LogStream {

    static #instance;

    /** @returns {LogStream} the process-wide stream pino writes to */
    static getInstance() {
        if (!LogStream.#instance) {
            LogStream.#instance = new LogStream();
        }
        return LogStream.#instance;
    }

    /**
     * @param {object} [options]
     * @param {number} [options.capacity] how many recent events are kept for replay
     */
    constructor({capacity = 1000} = {}) {
        this.capacity = capacity;
        this.buffer = [];
        this.lastId = 0;
        this.listeners = new Set();
    }

    /**
     * pino destination contract: receives one serialized JSON log line.
     * Must never throw - a failing subscriber can't be allowed to break logging.
     */
    write(chunk) {
        const event = this.#toEvent(chunk);
        this.buffer.push(event);
        if (this.buffer.length > this.capacity) {
            this.buffer.shift();
        }
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch {
                // a broken subscriber is dropped by its own close handler
            }
        }
        return true;
    }

    /**
     * Replays buffered events newer than `since`, then delivers new ones live.
     * @param {(event: object) => void} listener
     * @param {object} [options]
     * @param {number} [options.since] last event id the client already has (0 = whole backlog)
     * @returns {() => void} unsubscribe
     */
    subscribe(listener, {since = 0} = {}) {
        for (const event of this.buffer) {
            if (event.id > since) {
                listener(event);
            }
        }
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    #toEvent(chunk) {
        const line = typeof chunk === 'string' ? chunk : String(chunk);
        let record;
        try {
            record = JSON.parse(line);
        } catch {
            record = {level: LEVEL_VALUES.info, msg: line.trim()};
        }
        // production config formats levels as uppercase labels, dev keeps pino's numbers
        const levelValue = typeof record.level === 'number'
            ? record.level
            : LEVEL_VALUES[String(record.level).toLowerCase()] ?? LEVEL_VALUES.info;
        return {
            ...record,
            id: ++this.lastId,
            level: LEVEL_LABELS[levelValue] ?? String(record.level),
            levelValue,
        };
    }
}

export default LogStream;
