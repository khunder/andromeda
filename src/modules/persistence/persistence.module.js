 import mongoose from "mongoose";
import {Config} from "../../config/config.js";
import {AndromedaLogger} from "../../config/andromeda-logger.js";
 import {PersistenceGateway} from "./persistence-gateway.js";
import SqliteConnection from "./event-store/internal/sqlite/sqlite-connection.js";
import SqliteRepositoryBase from "./event-store/repositories/sqlite.repository.base.js";
import {TABLE_DEFINITIONS} from "./event-store/internal/sqlite/table-definitions.js";

const Logger = new AndromedaLogger();

export class PersistenceModule {

    constructor() {

    }

    static mongoose;

    static async init() {
        if (Config.getInstance().persistenceDriver === 'sqlite') {
            return PersistenceModule.initSqlite();
        }
        return PersistenceModule.initMongo();
    }

    static async initMongo() {
        return new Promise( (async (resolve, reject) => {
            try {
                Logger.info(`Mongoose trying to connect...`)
                this.mongoose = await mongoose.connect(Config.getInstance().mongoDbUri, {
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                    // useFindAndModify: false,
                    // useCreateIndex: true,
                    // reconnectTries: 30,
                    keepAlive: true,
                    //poolSize: 30,

                });
                Logger.info(`Mongoose connected`)
                await PersistenceGateway.init();
                resolve();
            }catch (e) {
                Logger.error(e)
                reject(e)
            }
        }));

    }

    static async initSqlite() {
        try {
            // only the owning engine process resets the database at startup ,
            // a container (always has `deploymentId` set) connects to whatever
            // the engine already created instead of wiping it out from under it
            if (!process.env.deploymentId) {
                Logger.info(`sqlite: this is the owning engine process, resetting database`)
                await SqliteConnection.reset();
            } else {
                await SqliteConnection.getInstance();
            }
            await PersistenceGateway.init();
        } catch (e) {
            Logger.error(e)
            throw e;
        }
    }

    static getConnection(){
        if (Config.getInstance().persistenceDriver === 'sqlite') {
            return {db: SqliteConnection.db};
        }
        return this.mongoose.connection
    }

    /**
     * Driver-agnostic read helpers for tests/tooling that need to assert on
     * persisted state without knowing whether the current run is backed by
     * MongoDB or sqlite. `tableName` is the collection/table name shared by
     * both drivers (e.g. "ProcessInstance", "FlowEvent") , see
     * TABLE_DEFINITIONS for the sqlite side.
     */
    static async countDocuments(tableName, cond = {}) {
        if (Config.getInstance().persistenceDriver === 'sqlite') {
            return new SqliteRepositoryBase(TABLE_DEFINITIONS[tableName]).count(cond);
        }
        return this.mongoose.connection.db.collection(tableName).countDocuments(cond);
    }

    static async findOne(tableName, cond = {}) {
        if (Config.getInstance().persistenceDriver === 'sqlite') {
            return new SqliteRepositoryBase(TABLE_DEFINITIONS[tableName]).findOne(cond);
        }
        return this.mongoose.connection.db.collection(tableName).findOne(cond);
    }

    static async dispose(){
        if (Config.getInstance().persistenceDriver === 'sqlite') {
            // best-effort: reliably resetting on next startup (see initSqlite)
            // is what actually guarantees a fresh database every session,
            // since a crash or force-kill would skip this graceful path
            SqliteConnection.close();
            return;
        }
        await mongoose.disconnect()
    }

}

export default PersistenceModule;
