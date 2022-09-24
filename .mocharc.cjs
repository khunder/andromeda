
module.exports = {
    "require": [
        "esm",
        "test/global.js"
    ],
    exclude: 'deployments/**/*',
    "recursive": true,
    "timeout": 30000,
    "color": true,
    "extension": [
        "js", "cjs", "mjs"
    ],
    "inline-diffs": false,
    "ui": "bdd"
}