/**
 * Request parsing and response shaping for Galaxy's read-only runtime
 * endpoints, GET /galaxy/process-instances and GET /galaxy/variables (see
 * controllers/galaxy.controller.js). Pure functions - the controller does the
 * PersistenceGateway calls - so this stays unit-testable on its own.
 */

/** ProcessInstanceStatus values (persistence's process-instance.orm-model.js) by name */
export const PROCESS_INSTANCE_STATUS = {active: 0, completed: 1, error: 2, aborted: 3};
const STATUS_NAMES = Object.fromEntries(Object.entries(PROCESS_INSTANCE_STATUS).map(([name, code]) => [code, name]));

export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 500;

/** An error the web module's error handler turns into this HTTP status. */
function badRequest(message) {
    return Object.assign(new Error(message), {statusCode: 400});
}

/**
 * @param {{limit?: string, offset?: string}} query
 * @returns {{limit: number, offset: number}}
 */
export function parsePaging(query = {}) {
    const limit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit);
    const offset = query.offset === undefined ? 0 : Number(query.offset);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        throw badRequest(`limit must be an integer between 1 and ${MAX_LIMIT}`);
    }
    if (!Number.isInteger(offset) || offset < 0) {
        throw badRequest('offset must be a non-negative integer');
    }
    return {limit, offset};
}

/**
 * @param {string} [status] - active|completed|error|aborted (case-insensitive)
 * @returns {number|undefined} the stored status code, undefined = any status
 */
export function parseStatus(status) {
    if (status === undefined || status === '') {
        return undefined;
    }
    const code = PROCESS_INSTANCE_STATUS[String(status).toLowerCase()];
    if (code === undefined) {
        throw badRequest(`status must be one of ${Object.keys(PROCESS_INSTANCE_STATUS).join('|')}`);
    }
    return code;
}

/**
 * Sorted, paged envelope. Neither persistence driver paginates queries, so
 * the page is cut here - fine at development volumes; a high-volume Galaxy
 * would push skip/limit down into the repositories.
 * @template T
 * @param {T[]} items - already sorted
 * @param {{limit: number, offset: number}} paging
 * @returns {{total: number, limit: number, offset: number, items: T[]}}
 */
export function page(items, {limit, offset}) {
    return {total: items.length, limit, offset, items: items.slice(offset, offset + limit)};
}

/** @param {object} row - a ProcessInstance record (either driver) */
export function toProcessInstance(row) {
    const lock = row.lock || null;
    return {
        id: row._id,
        deploymentId: row.deploymentId,
        processDef: row.processDef,
        status: STATUS_NAMES[row.status] ?? String(row.status),
        statusCode: row.status,
        // set while a container is executing the instance
        lockedBy: lock?.containerId ?? null,
        lockedAt: lock?.date ? new Date(lock.date).toISOString() : null,
    };
}

/** @param {object} row - a Variable record (either driver) */
export function toVariable(row) {
    return {
        processInstanceId: row.processInstance,
        processDef: row.processDef,
        name: row.name,
        type: row.type,
        value: decodeVariableValue(row.value, row.type),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    };
}

/**
 * Turns a stored variable value (always a string, see VariableRepository)
 * back into its declared type for API consumers. Deliberately not the
 * containers' VariableEncoder.transcodeVariable: that evaluates the stored
 * text as JavaScript, which a read endpoint must never do with data a process
 * wrote.
 * Anything that doesn't parse cleanly is returned as the stored string.
 * @param {string|null|undefined} raw
 * @param {string} type
 */
export function decodeVariableValue(raw, type) {
    if (raw === null || raw === undefined) {
        return null;
    }
    switch (type) {
        case 'string':
        case 'Date':
            return raw;
        case 'number': {
            const number = Number(raw);
            return raw.trim() !== '' && Number.isFinite(number) ? number : raw;
        }
        case 'boolean':
            if (raw === 'true') return true;
            if (raw === 'false' || raw === '') return false;
            return raw;
        default:
            try {
                return JSON.parse(raw);
            } catch {
                return raw;
            }
    }
}

/** Stable order for paging: by the given keys, compared as strings. */
export function sortBy(rows, ...keys) {
    return [...rows].sort((a, b) => {
        for (const key of keys) {
            const left = String(a[key] ?? '');
            const right = String(b[key] ?? '');
            if (left !== right) return left < right ? -1 : 1;
        }
        return 0;
    });
}
