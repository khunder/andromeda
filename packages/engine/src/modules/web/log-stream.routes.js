import {LEVEL_VALUES, LogStream} from "../../config/log-stream.js";

// a client that stops reading gets events dropped past this much unsent data,
// rather than growing this process's memory without bound
const MAX_PENDING_BYTES = 1024 * 1024;
// comment frames keep proxies/browsers from timing out an idle stream
const HEARTBEAT_MS = 15_000;

/**
 * GET /api/logs/stream - Server-Sent Events feed of this process's logs,
 * fed by the LogStream pino destination (not by reading the log file).
 *
 * Registered by WebModule itself rather than auto-loaded from src/routes, so
 * the engine and every generated container (which reuse this module
 * verbatim) expose the same endpoint.
 *
 * Query:
 *   level  minimum level to send: trace|debug|info|warn|error|fatal (default trace)
 *   since  replay buffered events after this id (default 0 = whole backlog);
 *          a reconnecting EventSource sends Last-Event-ID, which takes precedence
 *
 * Each event: `event: log`, `id: <n>`, `data: <pino record as JSON>` with
 * `level` normalized to its label and the numeric value in `levelValue`.
 */
export default function logStreamRoutes(fastify, opts, next) {
    const openStreams = new Set();

    // a held-open SSE response would otherwise keep fastify.close() waiting
    fastify.addHook('preClose', (done) => {
        for (const raw of openStreams) {
            raw.end();
        }
        openStreams.clear();
        done();
    });

    fastify.route({
        method: 'GET',
        url: '/api/logs/stream',
        handler: (request, reply) => {
            const minLevel = LEVEL_VALUES[String(request.query.level || 'trace').toLowerCase()] ?? LEVEL_VALUES.trace;
            const since = Number(request.headers['last-event-id'] ?? request.query.since ?? 0) || 0;

            reply.hijack();
            const raw = reply.raw;
            raw.writeHead(200, {
                // CORS headers already set on the reply by @fastify/cors's onRequest hook
                ...reply.getHeaders(),
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            });
            raw.write('retry: 3000\n\n');
            openStreams.add(raw);

            const send = (event) => {
                if (event.levelValue < minLevel || raw.writableLength > MAX_PENDING_BYTES) {
                    return;
                }
                raw.write(`id: ${event.id}\nevent: log\ndata: ${JSON.stringify(event)}\n\n`);
            };
            const unsubscribe = LogStream.getInstance().subscribe(send, {since});
            const heartbeat = setInterval(() => raw.write(': ping\n\n'), HEARTBEAT_MS);

            request.raw.on('close', () => {
                clearInterval(heartbeat);
                unsubscribe();
                openStreams.delete(raw);
            });
        }
    });

    next();
}
