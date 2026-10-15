import {describe, expect, it} from 'vitest';
import {loggable} from './log-redaction.js';

describe('loggable', () => {
    it('hides file content (string `data`) but keeps event `data` objects', () => {
        expect(loggable({_id: 'k', data: 'JVBERi0xLjcgYSBjb250cmFjdA==', size: 19}))
            .toBe('{"_id":"k","data":"<28 chars of content>","size":19}');
        expect(loggable({type: 'BULK_UPSERT_VARIABLES', data: {variables: [{name: 'age', value: 20}]}}))
            .toBe('{"type":"BULK_UPSERT_VARIABLES","data":{"variables":[{"name":"age","value":20}]}}');
    });

    it('truncates very long strings anywhere', () => {
        const logged = JSON.parse(loggable({nested: {blob: 'x'.repeat(5000)}}));
        expect(logged.nested.blob).toBe(`${'x'.repeat(64)}…<4936 more chars>`);
    });
});
