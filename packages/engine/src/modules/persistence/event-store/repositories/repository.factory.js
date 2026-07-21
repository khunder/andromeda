import {Config} from "../../../../config/config.js";
import BaseRepository from "./baseRepository.js";
import SqliteRepositoryBase from "./sqlite.repository.base.js";
import FakeRepositoryBase from "../internal/fake.repository.base.js";

/**
 * Picks the right repository backend for the current mode/driver, so each
 * *Repository class doesn't repeat the same three-way branch.
 */
export class RepositoryFactory {

    /**
     * @param {Model} mongooseModel
     * @param {{name: string, ddl: string, jsonFields: string[]}} sqliteTable
     * @returns {BaseRepository|SqliteRepositoryBase|FakeRepositoryBase}
     */
    static create(mongooseModel, sqliteTable) {
        if (Config.getInstance().isUnitTestMode) {
            return new FakeRepositoryBase(mongooseModel);
        }
        if (Config.getInstance().persistenceDriver === 'sqlite') {
            return new SqliteRepositoryBase(sqliteTable);
        }
        return new BaseRepository(mongooseModel);
    }
}

export default RepositoryFactory;
