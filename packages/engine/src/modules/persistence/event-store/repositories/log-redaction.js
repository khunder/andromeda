// Repository trace logs print whole documents. Keep file content (and any
// other large blob) out of them - logs also feed the live SSE log stream:
// - a string-valued `data` field is FileContent's base64 file content
//   (the event log's `data` is an object and stays visible)
// - any other string over MAX_LOGGED_STRING characters is truncated
const MAX_LOGGED_STRING = 2048;

/**
 * JSON for a trace log line, with file content and large strings redacted.
 * @param {*} value
 * @returns {string}
 */
export function loggable(value) {
    return JSON.stringify(value, (key, field) => {
        if (typeof field !== 'string') {
            return field;
        }
        if (key === 'data') {
            return `<${field.length} chars of content>`;
        }
        if (field.length > MAX_LOGGED_STRING) {
            return `${field.slice(0, 64)}…<${field.length - 64} more chars>`;
        }
        return field;
    });
}
