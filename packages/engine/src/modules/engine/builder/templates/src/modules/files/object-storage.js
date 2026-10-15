import fs from 'fs';
import path from 'path';

/**
 * Object storage contract for file variables, modelled on the S3 object API
 * (PutObject / GetObject / HeadObject / DeleteObject on a flat key space) so
 * an S3-compatible backend (AWS S3, RustFS, Garage, MinIO, ...) can implement
 * it one-to-one. Keys look like
 * `<deploymentId>/<version>/<processInstanceId>/<nodeId>/<fileName>`.
 *
 * Implementations: LocalFolderStorage (files on disk, the default for big
 * files) and DatabaseFileStorage (small files, in the persistence store).
 * See createObjectStorage() for picking one from configuration.
 */
export class ObjectStorage {
    /**
     * @param {string} key
     * @param {Buffer} body
     * @param {{contentType?: string, sha256?: string, metadata?: object}} [options]
     * @returns {Promise<void>}
     */
    async putObject(key, body, options) {
        throw new Error(`${this.constructor.name} does not implement putObject`);
    }

    /**
     * @param {string} key
     * @returns {Promise<{body: Buffer, contentType: string, size: number, sha256?: string, metadata?: object}|null>} null when absent
     */
    async getObject(key) {
        throw new Error(`${this.constructor.name} does not implement getObject`);
    }

    /**
     * Metadata only, without the content.
     * @param {string} key
     * @returns {Promise<{contentType: string, size: number, sha256?: string, metadata?: object}|null>} null when absent
     */
    async headObject(key) {
        throw new Error(`${this.constructor.name} does not implement headObject`);
    }

    /**
     * Deleting an absent key is not an error (same as S3).
     * @param {string} key
     * @returns {Promise<void>}
     */
    async deleteObject(key) {
        throw new Error(`${this.constructor.name} does not implement deleteObject`);
    }
}

/**
 * Rejects keys that could escape a storage root or are otherwise unusable
 * as object keys.
 * @param {string} key
 */
export function assertValidKey(key) {
    if (typeof key !== 'string' || key.length === 0 || key.length > 1024) {
        throw new Error('object key must be a non-empty string of at most 1024 characters');
    }
    if (key.startsWith('/') || key.includes('\\') || key.split('/').some((part) => part === '' || part === '.' || part === '..')) {
        throw new Error(`invalid object key "${key}"`);
    }
}

const META_SUFFIX = '.meta.json';

/**
 * Objects as plain files under `rootDir` (key = relative path), each with a
 * `<file>.meta.json` sidecar holding contentType / sha256 / metadata - the
 * local-folder equivalent of an S3 bucket.
 */
export class LocalFolderStorage extends ObjectStorage {
    /** @param {string} rootDir */
    constructor(rootDir) {
        super();
        this.rootDir = path.resolve(rootDir);
    }

    filePath(key) {
        assertValidKey(key);
        const resolved = path.resolve(this.rootDir, ...key.split('/'));
        if (!resolved.startsWith(this.rootDir + path.sep)) {
            throw new Error(`invalid object key "${key}"`);
        }
        return resolved;
    }

    async putObject(key, body, {contentType, sha256, metadata} = {}) {
        const file = this.filePath(key);
        await fs.promises.mkdir(path.dirname(file), {recursive: true});
        // write to a temp name first so a reader never sees a half-written file
        const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
        await fs.promises.writeFile(temp, body);
        await fs.promises.rename(temp, file);
        const meta = {contentType: contentType || 'application/octet-stream', size: body.length, sha256, metadata: metadata || null};
        await fs.promises.writeFile(file + META_SUFFIX, JSON.stringify(meta));
    }

    async getObject(key) {
        const meta = await this.headObject(key);
        if (!meta) return null;
        const body = await fs.promises.readFile(this.filePath(key));
        return {...meta, body};
    }

    async headObject(key) {
        const file = this.filePath(key);
        try {
            const stat = await fs.promises.stat(file);
            let meta = {};
            try {
                meta = JSON.parse(await fs.promises.readFile(file + META_SUFFIX, 'utf8'));
            } catch {
                // no sidecar (file dropped in by hand) - size from the file itself
            }
            return {contentType: meta.contentType || 'application/octet-stream', size: stat.size, sha256: meta.sha256, metadata: meta.metadata || null};
        } catch (error) {
            if (error.code === 'ENOENT') return null;
            throw error;
        }
    }

    async deleteObject(key) {
        const file = this.filePath(key);
        await fs.promises.rm(file, {force: true});
        await fs.promises.rm(file + META_SUFFIX, {force: true});
    }
}

/**
 * Small objects kept in the persistence store (FileContent table/collection,
 * not event-sourced), base64-encoded.
 */
export class DatabaseFileStorage extends ObjectStorage {
    /**
     * @param {{putFileContent: Function, getFileContent: Function, deleteFileContent: Function}} gateway - PersistenceGateway
     */
    constructor(gateway) {
        super();
        this.gateway = gateway;
    }

    async putObject(key, body, {contentType, sha256, metadata} = {}) {
        assertValidKey(key);
        await this.gateway.putFileContent(key, {
            data: body.toString('base64'),
            contentType: contentType || 'application/octet-stream',
            size: body.length,
            sha256,
            metadata: metadata || null,
        });
    }

    async getObject(key) {
        assertValidKey(key);
        const row = await this.gateway.getFileContent(key);
        if (!row) return null;
        return {body: Buffer.from(row.data, 'base64'), contentType: row.contentType, size: Number(row.size), sha256: row.sha256, metadata: row.metadata || null};
    }

    async headObject(key) {
        const object = await this.getObject(key);
        if (!object) return null;
        const {body, ...meta} = object;
        return meta;
    }

    async deleteObject(key) {
        assertValidKey(key);
        await this.gateway.deleteFileContent(key);
    }
}

/**
 * @param {{driver: string, rootDir: string}} options - driver 'local' (default)
 * @returns {ObjectStorage}
 */
export function createObjectStorage({driver = 'local', rootDir}) {
    switch (driver) {
        case 'local':
            return new LocalFolderStorage(rootDir);
        case 's3':
            throw new Error('FILE_STORAGE_DRIVER=s3 is not implemented yet - implement ObjectStorage (object-storage.js) on an S3 client to add it');
        default:
            throw new Error(`unknown FILE_STORAGE_DRIVER "${driver}" (supported: local)`);
    }
}
