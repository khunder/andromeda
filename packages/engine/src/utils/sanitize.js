


let illegalRe = /[\/\?<>\\:\*\|":]/g;
let controlRe = /[\x00-\x1f\x80-\x9f]/g;
let reservedRe = /^\.+$/;
let windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

function _sanitize(input, replacement) {
    let sanitized = input
        .replace(illegalRe, replacement)
        .replace(controlRe, replacement)
        .replace(reservedRe, replacement)
        .replace(windowsReservedRe, replacement);
    return sanitized.split("").splice(0, 255).join("");
}

const sanitize = function (input, options) {
    let replacement = (options && options.replacement) || '';
    let output = _sanitize(input, replacement);
    if (replacement === '') {
        return output;
    }
    return _sanitize(output, '');
};
export default sanitize;
