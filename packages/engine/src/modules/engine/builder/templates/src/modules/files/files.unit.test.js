import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import {collectFileInputs, FileInputError, FileTooLargeError} from './file-inputs.js';
import {FileService, safeFileName, safeKeySegment} from './file.service.js';
import {assertValidKey, DatabaseFileStorage, LocalFolderStorage} from './object-storage.js';

const KiB = 1024;

function memoryGateway() {
    const rows = new Map();
    return {
        rows,
        async putFileContent(key, content) { rows.set(key, {...content}); },
        async getFileContent(key) { return rows.get(key) ?? null; },
        async deleteFileContent(key) { rows.delete(key); },
    };
}

describe('file inputs', () => {
    let inputDir;
    let outsideDir;
    let server;
    let baseUrl;

    beforeAll(async () => {
        inputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'andromeda-inputs-'));
        outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'andromeda-outside-'));
        fs.mkdirSync(path.join(inputDir, 'reports'));
        fs.writeFileSync(path.join(inputDir, 'reports', 'q3.csv'), 'a,b\n1,2\n');
        fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'top secret');
        try {
            fs.symlinkSync(path.join(outsideDir, 'secret.txt'), path.join(inputDir, 'link.txt'));
        } catch {
            // symlinks need privileges on some Windows setups - that test is skipped then
        }

        server = http.createServer((req, res) => {
            if (req.url === '/doc.pdf') {
                res.writeHead(200, {'content-type': 'application/pdf; charset=binary'});
                res.end(Buffer.alloc(3 * KiB, 1));
            } else if (req.url === '/big-no-length') {
                res.writeHead(200, {'content-type': 'application/octet-stream'});
                for (let i = 0; i < 64; i++) res.write(Buffer.alloc(KiB, 2));
                res.end();
            } else if (req.url === '/named') {
                res.writeHead(200, {'content-disposition': 'attachment; filename="report final.txt"'});
                res.end('hello');
            } else {
                res.writeHead(404);
                res.end();
            }
        });
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    afterAll(async () => {
        await new Promise((resolve) => server.close(resolve));
        fs.rmSync(inputDir, {recursive: true, force: true});
        fs.rmSync(outsideDir, {recursive: true, force: true});
    });

    const collect = (body, files = [], options = {}) => collectFileInputs({body, files}, ['invoice', 'photo', 'report'], {inputDir, ...options});

    it('reads base64, data URLs, multipart uploads and paths', async () => {
        const inputs = collect({
            files: {
                invoice: {base64: Buffer.from('%PDF-1.7').toString('base64'), fileName: 'invoice.pdf', contentType: 'application/pdf'},
                photo: {base64: `data:image/png;base64,${Buffer.from('png!').toString('base64')}`},
                report: {path: 'reports/q3.csv'},
            },
        });
        const loaded = await Promise.all(inputs.map((input) => input.load(KiB)));
        expect(loaded.map(({fileName, contentType, body}) => [fileName, contentType, body.toString()])).toEqual([
            ['invoice.pdf', 'application/pdf', '%PDF-1.7'],
            ['photo', 'image/png', 'png!'],
            ['q3.csv', 'application/octet-stream', 'a,b\n1,2\n'],
        ]);

        const [upload] = collectFileInputs({files: [{fieldname: 'invoice', filename: 'a.txt', mimetype: 'text/plain', buffer: Buffer.from('hi')}]}, ['invoice']);
        expect(await upload.load(KiB)).toMatchObject({fileName: 'a.txt', contentType: 'text/plain'});
    });

    it('accepts `files` as a JSON string (multipart field)', () => {
        const inputs = collect({files: JSON.stringify({invoice: {base64: 'aGk='}})});
        expect(inputs.map((input) => input.variable)).toEqual(['invoice']);
    });

    it('downloads http(s) URLs, naming the file from the URL or Content-Disposition', async () => {
        const [pdf, named] = collect({files: {invoice: {url: `${baseUrl}/doc.pdf`}, report: {url: `${baseUrl}/named`}}});
        expect(await pdf.load(10 * KiB)).toMatchObject({fileName: 'doc.pdf', contentType: 'application/pdf'});
        expect((await named.load(KiB)).fileName).toBe('report final.txt');
    });

    it.each([
        ['an undeclared variable', {files: {other: {base64: 'aGk='}}}],
        ['no source', {files: {invoice: {fileName: 'x'}}}],
        ['two sources', {files: {invoice: {base64: 'aGk=', url: 'https://example.org/x'}}}],
        ['a non-http URL', {files: {invoice: {url: 'file:///etc/passwd'}}}],
        ['a path escaping the input folder', {files: {invoice: {path: '../../etc/passwd'}}}],
        ['an absolute path elsewhere', {files: {invoice: {path: path.resolve('/etc/passwd')}}}],
        ['files that is not an object', {files: '[1,2]'}],
    ])('rejects %s with a 400', (label, body) => {
        expect(() => collect(body)).toThrow(FileInputError);
        try { collect(body); } catch (error) { expect(error.statusCode).toBe(400); }
    });

    it('rejects the same variable twice (upload and JSON)', () => {
        expect(() => collect({files: {invoice: {base64: 'aGk='}}}, [{fieldname: 'invoice', filename: 'a', mimetype: 'x', buffer: Buffer.from('a')}])).toThrow(/more than one/);
    });

    it('disables path inputs when no input folder is configured', () => {
        expect(() => collect({files: {report: {path: 'reports/q3.csv'}}}, [], {inputDir: ''})).toThrow(/FILE_INPUT_DIR/);
    });

    it('rejects a symlink that leads outside the input folder', async (context) => {
        if (!fs.existsSync(path.join(inputDir, 'link.txt'))) context.skip();
        const [input] = collect({files: {report: {path: 'link.txt'}}});
        await expect(input.load(KiB)).rejects.toThrow(/inside the input folder/);
    });

    it('rejects invalid base64', async () => {
        const [input] = collect({files: {invoice: {base64: 'not base64!!'}}});
        await expect(input.load(KiB)).rejects.toThrow(/not valid base64/);
    });

    it('reports unreadable sources as 422', async () => {
        const [missing, notFound] = collect({files: {report: {path: 'reports/nope.csv'}, invoice: {url: `${baseUrl}/missing`}}});
        await expect(missing.load(KiB)).rejects.toMatchObject({statusCode: 422});
        await expect(notFound.load(KiB)).rejects.toMatchObject({statusCode: 422});
    });

    it('stops reading at the byte cap for every source', async () => {
        const inputs = collect({
            files: {
                invoice: {base64: Buffer.alloc(2 * KiB).toString('base64')},
                photo: {url: `${baseUrl}/big-no-length`},
                report: {path: 'reports/q3.csv'},
            },
        });
        for (const input of inputs) {
            await expect(input.load(4)).rejects.toBeInstanceOf(FileTooLargeError);
        }
        const [upload] = collectFileInputs({files: [{fieldname: 'invoice', filename: 'a', mimetype: 'x', buffer: Buffer.alloc(10)}]}, ['invoice']);
        await expect(upload.load(4)).rejects.toMatchObject({statusCode: 413});
    });
});

describe('FileService', () => {
    let rootDir;
    let gateway;
    let service;
    const warnings = [];

    beforeAll(() => {
        rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'andromeda-storage-'));
        gateway = memoryGateway();
        service = new FileService({
            objectStorage: new LocalFolderStorage(rootDir),
            databaseStorage: new DatabaseFileStorage(gateway),
            limits: {inlineMaxBytes: KiB, maxBytes: 4 * KiB, forcedMaxBytes: 8 * KiB},
            logger: {warn: (message) => warnings.push(message)},
        });
    });

    afterAll(() => fs.rmSync(rootDir, {recursive: true, force: true}));

    const input = (variable, size, fileName = `${variable}.bin`) => ({
        variable,
        load: async (maxBytes) => {
            if (size > maxBytes) throw new FileTooLargeError(variable, fileName, maxBytes);
            return {body: Buffer.alloc(size, 7), fileName, contentType: 'application/octet-stream'};
        },
    });
    const location = {deploymentId: 'orders', version: '1.2.0', processInstanceId: 'pi-1', nodeId: 'StartEvent_1'};

    it('keeps small files in the database and big ones in object storage, with only a reference + sha256', async () => {
        const loaded = await service.loadAll([input('small', 100), input('big', 2 * KiB)]);
        const {refs, warnings: found} = await service.storeAll(loaded, location);

        expect(found).toEqual([]);
        expect(refs.small).toMatchObject({kind: 'file', storage: 'database', size: 100, key: 'orders/1.2.0/pi-1/StartEvent_1/small.bin'});
        expect(refs.big).toMatchObject({storage: 'object', size: 2 * KiB, key: 'orders/1.2.0/pi-1/StartEvent_1/big.bin'});
        expect(refs.small.sha256).toBe(crypto.createHash('sha256').update(Buffer.alloc(100, 7)).digest('hex'));
        // the reference never carries the content
        expect(JSON.stringify(refs).length).toBeLessThan(1000);

        expect(gateway.rows.get(refs.small.key).data).toBe(Buffer.alloc(100, 7).toString('base64'));
        expect(fs.existsSync(path.join(rootDir, 'orders', '1.2.0', 'pi-1', 'StartEvent_1', 'big.bin'))).toBe(true);
        expect((await service.read(refs.big)).body.equals(Buffer.alloc(2 * KiB, 7))).toBe(true);
        expect((await service.read(refs.small)).body.equals(Buffer.alloc(100, 7))).toBe(true);
    });

    it('refuses files over the limit unless forced, then warns', async () => {
        await expect(service.loadAll([input('huge', 5 * KiB)])).rejects.toBeInstanceOf(FileTooLargeError);

        const loaded = await service.loadAll([input('huge', 5 * KiB)], {force: true});
        const {refs, warnings: found} = await service.storeAll(loaded, location);
        expect(refs.huge.warning).toMatch(/above the 4096 byte limit/);
        expect(found).toHaveLength(1);
        expect(warnings.at(-1)).toMatch(/huge/);

        // forcing has its own absolute cap
        await expect(service.loadAll([input('enormous', 9 * KiB)], {force: true})).rejects.toBeInstanceOf(FileTooLargeError);
    });

    it('keeps two files with the same name apart', async () => {
        const loaded = await service.loadAll([input('a', 10, 'same.txt'), input('b', 10, 'same.txt')]);
        const {refs} = await service.storeAll(loaded, {...location, processInstanceId: 'pi-2'});
        expect([refs.a.key, refs.b.key]).toEqual(['orders/1.2.0/pi-2/StartEvent_1/same.txt', 'orders/1.2.0/pi-2/StartEvent_1/same-2.txt']);
    });

    it('sanitises key segments and file names', () => {
        // no separators survive, and the segment can't start with a dot
        expect(safeKeySegment('../evil/../x')).toBe('__evil_.._x');
        expect(safeFileName('C:\\Users\\me\\..\\report.pdf')).toBe('report.pdf');
        expect(safeFileName('../../.env')).toBe('_env');
        expect(safeFileName('')).toBe('file');
    });
});

describe('object storage', () => {
    it.each(['', '/abs', 'a/../b', 'a//b', 'a\\b', './x'])('rejects the key %j', (key) => {
        expect(() => assertValidKey(key)).toThrow();
    });

    it('local folder storage round-trips content and metadata, and deletes', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'andromeda-local-'));
        try {
            const storage = new LocalFolderStorage(root);
            await storage.putObject('a/b/c.txt', Buffer.from('hello'), {contentType: 'text/plain', sha256: 'abc', metadata: {variable: 'v'}});
            expect(await storage.headObject('a/b/c.txt')).toEqual({contentType: 'text/plain', size: 5, sha256: 'abc', metadata: {variable: 'v'}});
            expect((await storage.getObject('a/b/c.txt')).body.toString()).toBe('hello');
            await storage.deleteObject('a/b/c.txt');
            expect(await storage.getObject('a/b/c.txt')).toBeNull();
            await expect(storage.deleteObject('a/b/c.txt')).resolves.toBeUndefined();
        } finally {
            fs.rmSync(root, {recursive: true, force: true});
        }
    });
});
