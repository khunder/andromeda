import {describe, expect, it} from 'vitest';
import pino from 'pino';
import {LogStream} from './log-stream.js';

describe('LogStream', () => {

    it('turns pino lines into events with ids and level labels', () => {
        const stream = new LogStream();
        const logger = pino({base: null}, stream);
        const received = [];
        stream.subscribe((event) => received.push(event));

        logger.child({name: 'engine'}).warn('disk almost full');

        expect(received).toHaveLength(1);
        expect(received[0]).toMatchObject({id: 1, level: 'warn', levelValue: 40, name: 'engine', msg: 'disk almost full'});
    });

    it('normalizes uppercase label levels from the production formatter', () => {
        const stream = new LogStream();
        stream.write(JSON.stringify({level: 'ERROR', msg: 'boom'}) + '\n');

        expect(stream.buffer[0]).toMatchObject({level: 'error', levelValue: 50, msg: 'boom'});
    });

    it('keeps non-JSON lines instead of throwing', () => {
        const stream = new LogStream();
        stream.write('plain text\n');

        expect(stream.buffer[0]).toMatchObject({level: 'info', msg: 'plain text'});
    });

    it('replays the backlog after `since`, bounded by capacity', () => {
        const stream = new LogStream({capacity: 3});
        for (let i = 1; i <= 5; i++) {
            stream.write(JSON.stringify({level: 30, msg: `m${i}`}));
        }

        const all = [];
        stream.subscribe((event) => all.push(event.msg));
        const afterFour = [];
        stream.subscribe((event) => afterFour.push(event.msg), {since: 4});

        expect(all).toEqual(['m3', 'm4', 'm5']);
        expect(afterFour).toEqual(['m5']);
    });

    it('stops delivering after unsubscribe and survives a throwing subscriber', () => {
        const stream = new LogStream();
        const received = [];
        stream.subscribe(() => { throw new Error('broken client'); });
        const unsubscribe = stream.subscribe((event) => received.push(event.msg));

        expect(() => stream.write(JSON.stringify({level: 30, msg: 'a'}))).not.toThrow();
        unsubscribe();
        stream.write(JSON.stringify({level: 30, msg: 'b'}));

        expect(received).toEqual(['a']);
    });
});
