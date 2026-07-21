import {v4} from 'uuid';
import SqliteConnection from '../internal/sqlite/sqlite-connection.js';
import {AndromedaLogger} from '../../../../config/andromeda-logger.js';

const Logger = new AndromedaLogger();

/**
 * SQLite-backed repository implementing the same method surface as
 * BaseRepository (Mongoose), so every *Repository class can use either driver
 * interchangeably without knowing which one it's talking to. See
 * SqliteConnection for the reload/persist coordination this relies on.
 */
export class SqliteRepositoryBase {

    /**
     * @param {{name: string, ddl: string, jsonFields: string[]}} tableDefinition
     */
    constructor(tableDefinition) {
        this.table = tableDefinition;
    }

    async ready() {
        await SqliteConnection.getInstance();
        SqliteConnection.reloadIfStale();
        return SqliteConnection.db;
    }

    isJsonField(key) {
        return this.table.jsonFields.includes(key);
    }

    encodeValue(key, value) {
        if (value === undefined || value === null) {
            return null;
        }
        if (this.isJsonField(key)) {
            return JSON.stringify(value);
        }
        if (value instanceof Date) {
            return value.toISOString();
        }
        return value;
    }

    decodeRow(row) {
        if (!row) {
            return row;
        }
        const decoded = {...row};
        this.table.jsonFields.forEach((field) => {
            if (decoded[field] != null && typeof decoded[field] === 'string') {
                try {
                    decoded[field] = JSON.parse(decoded[field]);
                } catch (e) {
                    // wasn't actually JSON , leave as-is
                }
            }
        });
        return decoded;
    }

    buildWhere(cond) {
        if (!cond || Object.keys(cond).length === 0) {
            return {clause: '', params: []};
        }
        const operatorSql = {$gte: '>=', $gt: '>', $lte: '<=', $lt: '<'};
        const parts = [];
        const params = [];
        Object.entries(cond).forEach(([key, value]) => {
            if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
                const [op] = Object.keys(value);
                if (!operatorSql[op]) {
                    throw new Error(`SqliteRepositoryBase: unsupported condition operator for "${key}": ${JSON.stringify(value)}`);
                }
                parts.push(`${key} ${operatorSql[op]} ?`);
                params.push(this.encodeValue(key, value[op]));
                return;
            }
            parts.push(`${key} = ?`);
            params.push(this.encodeValue(key, value));
        });
        return {clause: `WHERE ${parts.join(' AND ')}`, params};
    }

    buildOrderBy(sortOptions) {
        if (!sortOptions) {
            return '';
        }
        const [field, dir] = Object.entries(sortOptions)[0];
        return ` ORDER BY ${field} ${dir < 0 ? 'DESC' : 'ASC'}`;
    }

    runSelect(sql, params) {
        const stmt = SqliteConnection.db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows.map((r) => this.decodeRow(r));
    }

    runWrite(item, cond) {
        const columns = Object.keys(item);
        const setClause = columns.map((k) => `${k} = ?`).join(', ');
        const values = columns.map((k) => this.encodeValue(k, item[k]));
        const {clause, params} = this.buildWhere(cond);
        SqliteConnection.db.run(`UPDATE ${this.table.name} SET ${setClause} ${clause}`, [...values, ...params]);
    }

    async create(item) {
        await this.ready();
        const toInsert = item._id ? item : {...item, _id: v4()};
        Logger.trace(`Sqlite repository (${this.table.name}): creating item ${JSON.stringify(toInsert)}`);
        const columns = Object.keys(toInsert);
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map((c) => this.encodeValue(c, toInsert[c]));
        SqliteConnection.db.run(`INSERT INTO ${this.table.name} (${columns.join(', ')}) VALUES (${placeholders})`, values);
        SqliteConnection.persist();
        return toInsert;
    }

    async retrieve() {
        await this.ready();
        return this.runSelect(`SELECT * FROM ${this.table.name}`, []);
    }

    async findById(id) {
        await this.ready();
        const rows = this.runSelect(`SELECT * FROM ${this.table.name} WHERE _id = ?`, [id]);
        return rows[0] || null;
    }

    async findOne(cond = {}, fields, options = {}) {
        await this.ready();
        const {clause, params} = this.buildWhere(cond);
        const orderBy = this.buildOrderBy(options?.sort);
        const rows = this.runSelect(`SELECT * FROM ${this.table.name} ${clause}${orderBy} LIMIT 1`, params);
        return rows[0] || null;
    }

    async find(cond, fields, options, sortOptions) {
        await this.ready();
        const {clause, params} = this.buildWhere(cond);
        const orderBy = this.buildOrderBy(sortOptions);
        return this.runSelect(`SELECT * FROM ${this.table.name} ${clause}${orderBy}`, params);
    }

    async count(cond) {
        await this.ready();
        const {clause, params} = this.buildWhere(cond);
        const rows = this.runSelect(`SELECT COUNT(*) as count FROM ${this.table.name} ${clause}`, params);
        return rows[0]?.count || 0;
    }

    async upsert(cond, item) {
        await this.ready();
        Logger.trace(`Sqlite repository (${this.table.name}): upsert: cond:${JSON.stringify(cond)}, item : ${JSON.stringify(item)}`);
        const existing = await this.findOne(cond);
        if (existing) {
            this.runWrite(item, cond);
            SqliteConnection.persist();
            return this.findOne(cond);
        }
        const toInsert = {...item};
        Object.entries(cond).forEach(([k, v]) => {
            if (toInsert[k] === undefined && !(v && typeof v === 'object')) {
                toInsert[k] = v;
            }
        });
        return this.create(toInsert);
    }

    // updates an existing row only: no row is created when cond matches
    // nothing, and null is returned in that case rather than re-querying by
    // the original cond - which would silently miss the row whenever `item`
    // overwrites a field `cond` also filters on (e.g. a conditional status
    // transition), since after the write the row no longer matches its own
    // pre-write cond. The select-then-write below is deliberately kept
    // synchronous (no `await` between them, only sql.js's own synchronous
    // calls) after the single `ready()` at the top - callers relying on this
    // as a conditional claim (e.g. FlowEventRepository.closeFlowEventIfActive)
    // need the check-and-write to be a single atomic step within this
    // process; an `await` in between would let another concurrent call in
    // the same process interleave and see the same still-unclaimed row.
    async update(cond, item) {
        await this.ready();
        Logger.trace(`Sqlite repository (${this.table.name}): update: cond:${JSON.stringify(cond)}, item : ${JSON.stringify(item)}`);
        const {clause, params} = this.buildWhere(cond);
        const match = this.runSelect(`SELECT * FROM ${this.table.name} ${clause} LIMIT 1`, params)[0];
        if (!match) {
            return null;
        }
        this.runWrite(item, {_id: match._id});
        SqliteConnection.persist();
        return this.runSelect(`SELECT * FROM ${this.table.name} WHERE _id = ?`, [match._id])[0] || null;
    }

    async createMany(items) {
        await this.ready();
        Logger.trace(`Sqlite repository (${this.table.name}): creating ${items.length} items`);
        items.forEach((item) => {
            const toInsert = item._id ? item : {...item, _id: v4()};
            const columns = Object.keys(toInsert);
            const placeholders = columns.map(() => '?').join(', ');
            const values = columns.map((c) => this.encodeValue(c, toInsert[c]));
            SqliteConnection.db.run(`INSERT INTO ${this.table.name} (${columns.join(', ')}) VALUES (${placeholders})`, values);
        });
        SqliteConnection.persist();
        return items;
    }

    // full collection dump as plain objects, used to capture snapshot state
    async dumpAll() {
        return this.retrieve();
    }

    // replaces the whole table with the given docs, used to restore a snapshot
    async restoreAll(docs) {
        await this.ready();
        SqliteConnection.db.run(`DELETE FROM ${this.table.name}`);
        if (docs && docs.length > 0) {
            docs.forEach((item) => {
                const toInsert = item._id ? item : {...item, _id: v4()};
                const columns = Object.keys(toInsert);
                const placeholders = columns.map(() => '?').join(', ');
                const values = columns.map((c) => this.encodeValue(c, toInsert[c]));
                SqliteConnection.db.run(`INSERT INTO ${this.table.name} (${columns.join(', ')}) VALUES (${placeholders})`, values);
            });
        }
        SqliteConnection.persist();
    }

    // per-document upserts via {updateOne: {filter, update: {$set, $setOnInsert}, upsert}}
    async bulkWrite(operations) {
        await this.ready();
        Logger.trace(`Sqlite repository (${this.table.name}): bulkWrite ${operations.length} operations`);
        operations.forEach(({updateOne}) => {
            const {filter, update, upsert} = updateOne;
            const {clause, params} = this.buildWhere(filter);
            const existingRows = this.runSelect(`SELECT * FROM ${this.table.name} ${clause} LIMIT 1`, params);
            const existing = existingRows[0];
            const setFields = update['$set'] || {};
            if (existing) {
                this.runWrite(setFields, filter);
            } else if (upsert) {
                const toInsert = {...setFields, ...(update['$setOnInsert'] || {})};
                Object.entries(filter).forEach(([k, v]) => {
                    if (toInsert[k] === undefined) {
                        toInsert[k] = v;
                    }
                });
                const columns = Object.keys(toInsert);
                const placeholders = columns.map(() => '?').join(', ');
                const values = columns.map((c) => this.encodeValue(c, toInsert[c]));
                SqliteConnection.db.run(`INSERT INTO ${this.table.name} (${columns.join(', ')}) VALUES (${placeholders})`, values);
            }
        });
        SqliteConnection.persist();
    }

    async delete(_id) {
        await this.ready();
        Logger.trace(`Sqlite repository (${this.table.name}): delete: id:${_id}`);
        SqliteConnection.db.run(`DELETE FROM ${this.table.name} WHERE _id = ?`, [_id]);
        SqliteConnection.persist();
    }

    async deleteAll() {
        await this.ready();
        Logger.trace(`Sqlite repository (${this.table.name}): delete all`);
        SqliteConnection.db.run(`DELETE FROM ${this.table.name}`);
        SqliteConnection.persist();
    }

    getModel() {
        return this.table.name;
    }
}

export default SqliteRepositoryBase;
