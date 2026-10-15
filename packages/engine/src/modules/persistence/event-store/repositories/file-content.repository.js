import {AndromedaLogger} from "../../../../config/andromeda-logger.js";
import FileContentModel from "../internal/models/file-content.orm-model.js";
import {RepositoryFactory} from "./repository.factory.js";
import {TABLE_DEFINITIONS} from "../internal/sqlite/table-definitions.js";

const Logger = new AndromedaLogger();

/**
 * Plain (non-event-sourced) store for small files' content, base64-encoded -
 * see file-content.orm-model.js. Backs the containers' database file storage.
 */
export class FileContentRepository {

    /**
     * @type {BaseRepository}
     */
    repo;

    constructor() {
        this.repo = RepositoryFactory.create(FileContentModel, TABLE_DEFINITIONS.FileContent);
    }

    /**
     * Creates or replaces the content stored under `key`.
     * @param {string} key
     * @param {{data: string, contentType: string, size: number, sha256: string, metadata?: object}} content
     */
    async put(key, {data, contentType, size, sha256, metadata}) {
        Logger.debug(`storing ${size} byte(s) of file content under ${key}`);
        const now = new Date();
        await this.repo.upsert({_id: key}, {_id: key, data, contentType, size, sha256, metadata: metadata || null, updatedAt: now});
    }

    /**
     * @param {string} key
     * @returns {Promise<object|null>}
     */
    async get(key) {
        return this.repo.findById(key);
    }

    /**
     * @param {string} key
     */
    async delete(key) {
        await this.repo.delete(key);
    }
}

export default FileContentRepository;
