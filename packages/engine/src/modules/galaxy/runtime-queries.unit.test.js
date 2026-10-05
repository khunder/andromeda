import {describe, expect, it} from 'vitest';
import {
    decodeVariableValue,
    MAX_LIMIT,
    page,
    parsePaging,
    parseStatus,
    sortBy,
    toProcessInstance,
    toVariable,
} from './runtime-queries.js';

describe('runtime-queries', () => {

    describe('parsePaging', () => {
        it('defaults to the first 100', () => {
            expect(parsePaging({})).toEqual({limit: 100, offset: 0});
        });

        it('parses query strings', () => {
            expect(parsePaging({limit: '25', offset: '50'})).toEqual({limit: 25, offset: 50});
        });

        it.each([
            [{limit: '0'}],
            [{limit: String(MAX_LIMIT + 1)}],
            [{limit: 'abc'}],
            [{limit: '2.5'}],
            [{offset: '-1'}],
        ])('rejects %j with a 400', (query) => {
            expect(() => parsePaging(query)).toThrow(expect.objectContaining({statusCode: 400}));
        });
    });

    describe('parseStatus', () => {
        it('maps names to stored codes, case-insensitively', () => {
            expect(parseStatus('active')).toBe(0);
            expect(parseStatus('Completed')).toBe(1);
            expect(parseStatus(undefined)).toBeUndefined();
            expect(parseStatus('')).toBeUndefined();
        });

        it('rejects unknown statuses with a 400', () => {
            expect(() => parseStatus('running')).toThrow(expect.objectContaining({statusCode: 400}));
        });
    });

    it('pages a sorted list and reports the total', () => {
        const items = ['a', 'b', 'c', 'd', 'e'];
        expect(page(items, {limit: 2, offset: 2})).toEqual({total: 5, limit: 2, offset: 2, items: ['c', 'd']});
        expect(page(items, {limit: 2, offset: 10}).items).toEqual([]);
    });

    it('sorts by several keys', () => {
        const rows = [{p: 'b', n: 'x'}, {p: 'a', n: 'z'}, {p: 'a', n: 'y'}];
        expect(sortBy(rows, 'p', 'n')).toEqual([{p: 'a', n: 'y'}, {p: 'a', n: 'z'}, {p: 'b', n: 'x'}]);
    });

    describe('toProcessInstance', () => {
        it('names the status and flattens the lock (sqlite rows carry the date as a string)', () => {
            expect(toProcessInstance({
                _id: 'pi-1', deploymentId: 'demo_1_0_0', processDef: 'Order', status: 0,
                lock: {containerId: 'host-1', date: '2026-10-05T10:00:00.000Z'},
            })).toEqual({
                id: 'pi-1', deploymentId: 'demo_1_0_0', processDef: 'Order',
                status: 'active', statusCode: 0, lockedBy: 'host-1', lockedAt: '2026-10-05T10:00:00.000Z',
            });
        });

        it('handles an unlocked, completed instance (mongo rows carry a Date)', () => {
            expect(toProcessInstance({_id: 'pi-2', deploymentId: 'd', processDef: 'P', status: 1, lock: null}))
                .toMatchObject({status: 'completed', lockedBy: null, lockedAt: null});
            expect(toProcessInstance({_id: 'pi-3', status: 2, lock: {containerId: 'c', date: new Date('2026-01-01T00:00:00Z')}}))
                .toMatchObject({status: 'error', lockedAt: '2026-01-01T00:00:00.000Z'});
        });
    });

    it('toVariable renames the instance field and decodes the value', () => {
        expect(toVariable({
            processInstance: 'pi-1', processDef: 'Order', name: 'age', type: 'number', value: '23',
            updatedAt: '2026-10-05T10:00:00.000Z',
        })).toEqual({
            processInstanceId: 'pi-1', processDef: 'Order', name: 'age', type: 'number', value: 23,
            updatedAt: '2026-10-05T10:00:00.000Z',
        });
    });

    describe('decodeVariableValue', () => {
        it.each([
            ['23', 'number', 23],
            ['-1.5', 'number', -1.5],
            ['not a number', 'number', 'not a number'],
            ['', 'number', ''],
            ['true', 'boolean', true],
            ['false', 'boolean', false],
            ['', 'boolean', false],
            ['hello', 'string', 'hello'],
            ['2026-10-05T10:00:00.000Z', 'Date', '2026-10-05T10:00:00.000Z'],
            ['{"a":1}', 'object', {a: 1}],
            ['[1,2]', 'array', [1, 2]],
            ['{broken', 'object', '{broken'],
            [null, 'string', null],
        ])('%j as %s -> %j', (raw, type, expected) => {
            expect(decodeVariableValue(raw, type)).toEqual(expected);
        });

        it('never evaluates stored text', () => {
            globalThis.__decodedSideEffect = false;
            const hostile = '${globalThis.__decodedSideEffect = true}';
            for (const type of ['string', 'number', 'boolean', 'Date', 'object']) {
                decodeVariableValue(hostile, type);
            }
            expect(globalThis.__decodedSideEffect).toBe(false);
            delete globalThis.__decodedSideEffect;
        });
    });
});
