import crypto from 'crypto';
import {FileTooLargeError} from './file-inputs.js';

/**
 * Turns loaded file inputs into stored objects and the file references kept
 * in file variables.
 *
 * Size policy:
 * - up to `inlineMaxBytes` (FILE_INLINE_MAX_BYTES, 256 KiB) - kept in the
 *   persistence store (database storage)
 * - up to `maxBytes` (FILE_MAX_BYTES, 10 MiB) - object storage
 * - bigger - refused (FileTooLargeError), unless the caller forces it: then
 *   accepted up to `forcedMaxBytes` (FILE_FORCED_MAX_BYTES) with a warning
 *
 * A file variable only ever holds the reference below - never the bytes - so
 * the event log, the Variable table, Galaxy and script tasks see the file's
 * metadata and sha256 but not its content.
 *
 * @typedef {object} FileRef
 * @property {'file'} kind
 * @property {string} fileName
 * @property {string} contentType
 * @property {number} size - bytes
 * @property {string} sha256 - hex digest of the content
 * @property {'database'|'object'} storage - which store holds the content
 * @property {string} key - object key in that store
 * @property {string} nodeId - node the file was received at
 * @property {string} uploadedAt - ISO 8601
 * @property {string} [warning] - set when a size limit was forced
 */
export class FileService {
    /**
     * @param {object} options
     * @param {import('./object-storage.js').ObjectStorage} options.objectStorage
     * @param {import('./object-storage.js').ObjectStorage} options.databaseStorage
     * @param {{inlineMaxBytes: number, maxBytes: number, forcedMaxBytes: number}} options.limits
     * @param {{warn: Function}} [options.logger]
     */
    constructor({objectStorage, databaseStorage, limits, logger}) {
        this.objectStorage = objectStorage;
        this.databaseStorage = databaseStorage;
        this.limits = limits;
        this.logger = logger;
    }

    /**
     * Reads every input's content, refusing anything over the size limit
     * (or the forced limit when `force`). Nothing is stored yet.
     * @param {import('./file-inputs.js').FileInput[]} inputs
     * @param {{force?: boolean}} [options]
     * @returns {Promise<Array<{variable: string, body: Buffer, fileName: string, contentType: string}>>}
     * @throws {FileTooLargeError}
     */
    async loadAll(inputs, {force = false} = {}) {
        const cap = force ? Math.max(this.limits.forcedMaxBytes, this.limits.maxBytes) : this.limits.maxBytes;
        const loaded = [];
        for (const input of inputs) {
            const file = await input.load(cap);
            loaded.push({variable: input.variable, ...file});
        }
        return loaded;
    }

    /**
     * Stores loaded files under `<deploymentId>/<version>/<processInstanceId>/<nodeId>/<fileName>`.
     * @param {Array<{variable: string, body: Buffer, fileName: string, contentType: string}>} files
     * @param {{deploymentId: string, version: string, processInstanceId: string, nodeId: string}} location
     * @returns {Promise<{refs: Object<string, FileRef>, warnings: string[]}>} refs keyed by variable name
     */
    async storeAll(files, {deploymentId, version, processInstanceId, nodeId}) {
        const refs = {};
        const warnings = [];
        const usedKeys = new Set();
        for (const file of files) {
            const prefix = [deploymentId, version, processInstanceId, nodeId].map(safeKeySegment).join('/');
            const key = uniqueKey(`${prefix}/${safeFileName(file.fileName)}`, usedKeys);
            const sha256 = crypto.createHash('sha256').update(file.body).digest('hex');
            const inline = file.body.length <= this.limits.inlineMaxBytes;
            const storage = inline ? this.databaseStorage : this.objectStorage;
            await storage.putObject(key, file.body, {contentType: file.contentType, sha256, metadata: {variable: file.variable, processInstanceId, nodeId}});

            /** @type {FileRef} */
            const ref = {
                kind: 'file',
                fileName: file.fileName,
                contentType: file.contentType,
                size: file.body.length,
                sha256,
                storage: inline ? 'database' : 'object',
                key,
                nodeId,
                uploadedAt: new Date().toISOString(),
            };
            if (file.body.length > this.limits.maxBytes) {
                ref.warning = `${file.body.length} bytes is above the ${this.limits.maxBytes} byte limit - accepted because the limit was forced`;
                warnings.push(`${file.variable}: ${ref.warning}`);
                this.logger?.warn(`file variable ${file.variable} of process instance ${processInstanceId}: ${ref.warning}`);
            }
            refs[file.variable] = ref;
        }
        return {refs, warnings};
    }

    /**
     * Content of a stored file, from whichever store holds it.
     * @param {FileRef} ref
     * @returns {Promise<{body: Buffer, contentType: string, size: number}|null>}
     */
    async read(ref) {
        const storage = ref.storage === 'database' ? this.databaseStorage : this.objectStorage;
        return storage.getObject(ref.key);
    }
}

/** One path segment of an object key: no separators, nothing hidden. */
export function safeKeySegment(value) {
    const cleaned = String(value ?? '').replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '_');
    return cleaned.slice(0, 200) || '_';
}

/** A file name safe to use as the last key segment (keeps spaces and unicode letters readable). */
export function safeFileName(name) {
    const base = String(name ?? '').split(/[\\/]/).pop();
    const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, '_').replace(/^\.+/, '_').trim();
    return cleaned.slice(0, 200) || 'file';
}

function uniqueKey(key, used) {
    let candidate = key;
    for (let n = 2; used.has(candidate); n++) {
        const dot = key.lastIndexOf('.');
        const slash = key.lastIndexOf('/');
        candidate = dot > slash ? `${key.slice(0, dot)}-${n}${key.slice(dot)}` : `${key}-${n}`;
    }
    used.add(candidate);
    return candidate;
}

export {FileTooLargeError};
