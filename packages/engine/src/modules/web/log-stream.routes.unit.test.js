import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import logStreamRoutes from './log-stream.routes.js';
import {LogStream} from '../../config/log-stream.js';

// reads SSE frames from a fetch response until `count` log events arrived
async function readEvents(response, count) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const events = [];
    let text = '';
    while (events.length < count) {
        const {value, done} = await reader.read();
        if (done) break;
        text += decoder.decode(value, {stream: true});
        const frames = text.split('\n\n');
        text = frames.pop();
        for (const frame of frames) {
            const data = frame.split('\n').find((line) => line.startsWith('data: '));
            const id = frame.split('\n').find((line) => line.startsWith('id: '));
            if (data) events.push({id: Number(id.slice(4)), ...JSON.parse(data.slice(6))});
        }
    }
    await reader.cancel();
    return events;
}

describe('GET /api/logs/stream', () => {
    let app;
    let baseUrl;
    const stream = LogStream.getInstance();
    const log = (level, msg) => stream.write(JSON.stringify({level, msg, name: 'test'}));

    beforeEach(async () => {
        app = fastify();
        app.register(fastifyCors, {origin: ['http://localhost:3000']});
        app.register(logStreamRoutes);
        await app.listen({port: 0, host: '127.0.0.1'});
        baseUrl = `http://127.0.0.1:${app.server.address().port}`;
    });

    afterEach(async () => {
        await app.close();
    });

    it('streams live log events as SSE with CORS headers', async () => {
        const response = await fetch(`${baseUrl}/api/logs/stream?since=${stream.lastId}`, {
            headers: {Origin: 'http://localhost:3000'},
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/event-stream');
        expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');

        log(30, 'first');
        log(50, 'second');
        const events = await readEvents(response, 2);

        expect(events.map((e) => [e.level, e.msg])).toEqual([['info', 'first'], ['error', 'second']]);
        expect(events[1].id).toBe(events[0].id + 1);
    });

    it('replays history after Last-Event-ID and filters by minimum level', async () => {
        const before = stream.lastId;
        log(20, 'debug noise');
        log(40, 'a warning');

        const response = await fetch(`${baseUrl}/api/logs/stream?level=warn`, {
            headers: {'Last-Event-ID': String(before)},
        });
        log(50, 'live error');
        const events = await readEvents(response, 2);

        expect(events.map((e) => e.msg)).toEqual(['a warning', 'live error']);
    });

    it('does not keep the server from closing while a client is connected', async () => {
        const response = await fetch(`${baseUrl}/api/logs/stream`);
        expect(response.status).toBe(200);

        await expect(app.close()).resolves.toBeUndefined();
    });
});
