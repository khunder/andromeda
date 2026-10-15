import fs from 'fs';
import path from 'path';

/**
 * Reads the files a caller hands to POST /{processDef}/start or /signal and
 * loads their bytes, enforcing a byte cap while reading.
 *
 * Two ways in, mirroring how `variables` is passed:
 * - `files` in the body - an object keyed by file variable name (a JSON
 *   string when the request is multipart):
 *     { "invoice": { "base64": "JVBERi0...", "fileName": "invoice.pdf", "contentType": "application/pdf" },
 *       "photo":   { "url": "https://example.org/a.png" },
 *       "report":  { "path": "reports/q3.csv" } }
 *   exactly one of base64 (plain or a data: URL) / url (http/https) / path
 *   (relative to the configured input folder) per file.
 * - multipart file parts whose field name is the file variable name.
 */

/** An error carrying the HTTP status the controller should answer with. */
export class FileInputError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
    }
}

/** Thrown when a file is bigger than the byte cap it was loaded with. */
export class FileTooLargeError extends Error {
    constructor(variable, fileName, limit) {
        super(`file "${fileName}" for variable "${variable}" exceeds the ${limit} byte limit`);
        this.statusCode = 413;
        this.variable = variable;
        this.fileName = fileName;
        this.limit = limit;
    }
}

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
const DATA_URL_PATTERN = /^data:([^;,]*)(?:;[^,]*)?;base64,/i;

/**
 * @typedef {object} FileInput
 * @property {string} variable - file variable name
 * @property {string} [fileName]
 * @property {string} [contentType]
 * @property {'base64'|'url'|'path'|'upload'} source
 * @property {(maxBytes: number) => Promise<{body: Buffer, fileName: string, contentType: string}>} load
 */

/**
 * Collects the file inputs of a request. Validates shape and names only -
 * nothing is read yet, so a bad request is rejected before anything is created.
 * @param {{body?: object, files?: Array<{fieldname: string, filename: string, mimetype: string, buffer: Buffer}>}} request
 * @param {string[]} fileVariables - names of the workflow's `file` variables
 * @param {{inputDir?: string, urlTimeoutMs?: number}} options
 * @returns {FileInput[]}
 */
export function collectFileInputs(request, fileVariables, {inputDir, urlTimeoutMs = 30_000} = {}) {
    const declared = new Set(fileVariables);
    const inputs = [];
    const seen = new Set();
    const claim = (variable) => {
        if (!declared.has(variable)) {
            const hint = fileVariables.length ? ` (file variables: ${fileVariables.join(', ')})` : ' (this workflow declares none)';
            throw new FileInputError(`"${variable}" is not a file variable${hint}`);
        }
        if (seen.has(variable)) {
            throw new FileInputError(`more than one file given for variable "${variable}"`);
        }
        seen.add(variable);
    };

    for (const part of request.files || []) {
        const variable = part.fieldname;
        claim(variable);
        const fileName = part.filename || variable;
        const contentType = part.mimetype || 'application/octet-stream';
        inputs.push({
            variable, fileName, contentType, source: 'upload',
            load: async (maxBytes) => {
                if (part.buffer.length > maxBytes) throw new FileTooLargeError(variable, fileName, maxBytes);
                return {body: part.buffer, fileName, contentType};
            },
        });
    }

    let specs = request.body?.files;
    if (typeof specs === 'string') {
        try {
            specs = JSON.parse(specs);
        } catch {
            throw new FileInputError('"files" must be a JSON object keyed by file variable name');
        }
    }
    if (specs === undefined || specs === null || specs === '') {
        return inputs;
    }
    if (typeof specs !== 'object' || Array.isArray(specs)) {
        throw new FileInputError('"files" must be an object keyed by file variable name');
    }

    for (const [variable, spec] of Object.entries(specs)) {
        claim(variable);
        if (!spec || typeof spec !== 'object') {
            throw new FileInputError(`files.${variable} must be an object with one of base64, url or path`);
        }
        const sources = ['base64', 'url', 'path'].filter((key) => spec[key] !== undefined);
        if (sources.length !== 1) {
            throw new FileInputError(`files.${variable} needs exactly one of base64, url or path`);
        }
        const fileName = spec.fileName !== undefined ? String(spec.fileName) : undefined;
        const contentType = spec.contentType !== undefined ? String(spec.contentType) : undefined;
        const source = sources[0];
        const value = spec[source];
        if (typeof value !== 'string' || value.length === 0) {
            throw new FileInputError(`files.${variable}.${source} must be a non-empty string`);
        }

        if (source === 'base64') {
            inputs.push({variable, fileName, contentType, source, load: (maxBytes) => loadBase64(variable, value, {fileName, contentType}, maxBytes)});
        } else if (source === 'url') {
            const url = parseHttpUrl(variable, value);
            inputs.push({variable, fileName, contentType, source, load: (maxBytes) => loadUrl(variable, url, {fileName, contentType, timeoutMs: urlTimeoutMs}, maxBytes)});
        } else {
            const {root, file} = resolveInputPath(variable, value, inputDir);
            inputs.push({variable, fileName, contentType, source, load: (maxBytes) => loadPath(variable, root, file, {fileName, contentType}, maxBytes)});
        }
    }
    return inputs;
}

async function loadBase64(variable, value, {fileName, contentType}, maxBytes) {
    let data = value.trim();
    let detectedType;
    const dataUrl = data.match(DATA_URL_PATTERN);
    if (dataUrl) {
        detectedType = dataUrl[1] || undefined;
        data = data.slice(dataUrl[0].length);
    }
    data = data.replace(/\s+/g, '');
    const name = fileName || variable;
    // decoded size is known before decoding - don't allocate an oversized buffer
    const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
    if (Math.floor(data.length * 3 / 4) - padding > maxBytes) {
        throw new FileTooLargeError(variable, name, maxBytes);
    }
    if (data.length % 4 !== 0 || !BASE64_PATTERN.test(data)) {
        throw new FileInputError(`files.${variable}.base64 is not valid base64`);
    }
    return {body: Buffer.from(data, 'base64'), fileName: name, contentType: contentType || detectedType || 'application/octet-stream'};
}

function parseHttpUrl(variable, value) {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new FileInputError(`files.${variable}.url is not a valid URL`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new FileInputError(`files.${variable}.url must be http or https`);
    }
    return url;
}

async function loadUrl(variable, url, {fileName, contentType, timeoutMs}, maxBytes) {
    let response;
    try {
        response = await fetch(url, {signal: AbortSignal.timeout(timeoutMs), redirect: 'follow'});
    } catch (error) {
        throw new FileInputError(`files.${variable}: could not download ${url.href} (${error.name === 'TimeoutError' ? `no answer within ${timeoutMs} ms` : error.message})`, 422);
    }
    if (!response.ok) {
        throw new FileInputError(`files.${variable}: downloading ${url.href} answered HTTP ${response.status}`, 422);
    }
    const name = fileName || fileNameFromResponse(response, url) || variable;
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        await response.body?.cancel().catch(() => undefined);
        throw new FileTooLargeError(variable, name, maxBytes);
    }
    // count while streaming - content-length can be missing or wrong
    const chunks = [];
    let size = 0;
    const reader = response.body.getReader();
    for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) {
            await reader.cancel().catch(() => undefined);
            throw new FileTooLargeError(variable, name, maxBytes);
        }
        chunks.push(value);
    }
    const headerType = response.headers.get('content-type')?.split(';')[0].trim();
    return {body: Buffer.concat(chunks), fileName: name, contentType: contentType || headerType || 'application/octet-stream'};
}

function fileNameFromResponse(response, url) {
    const disposition = response.headers.get('content-disposition');
    const match = disposition && disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    if (match) {
        try {
            return decodeURIComponent(match[1]);
        } catch {
            return match[1];
        }
    }
    const last = url.pathname.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : undefined;
}

/**
 * `path` sources are only read from inside the configured input folder
 * (FILE_INPUT_DIR) - otherwise any caller could make the container read its
 * own secrets.
 */
function resolveInputPath(variable, value, inputDir) {
    if (!inputDir) {
        throw new FileInputError(`files.${variable}.path: local files are disabled (set FILE_INPUT_DIR to allow reading from a folder)`);
    }
    const root = path.resolve(inputDir);
    const file = path.resolve(root, value);
    if (!file.startsWith(root + path.sep)) {
        throw new FileInputError(`files.${variable}.path must stay inside the input folder`);
    }
    return {root, file};
}

async function loadPath(variable, root, file, {fileName, contentType}, maxBytes) {
    let stat;
    try {
        // compare real paths: a symlink inside the folder must not lead outside it
        const realRoot = await fs.promises.realpath(root);
        const real = await fs.promises.realpath(file);
        if (!real.startsWith(realRoot + path.sep)) {
            throw new FileInputError(`files.${variable}.path must stay inside the input folder`);
        }
        stat = await fs.promises.stat(real);
        if (!stat.isFile()) {
            throw new FileInputError(`files.${variable}.path is not a file`, 422);
        }
        file = real;
    } catch (error) {
        if (error instanceof FileInputError) throw error;
        throw new FileInputError(`files.${variable}.path: ${error.code === 'ENOENT' ? 'no such file' : error.message}`, 422);
    }
    const name = fileName || path.basename(file);
    if (stat.size > maxBytes) {
        throw new FileTooLargeError(variable, name, maxBytes);
    }
    return {body: await fs.promises.readFile(file), fileName: name, contentType: contentType || 'application/octet-stream'};
}
