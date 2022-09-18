'use strict';

module.exports = {
    "require": [
        "esm",
        "test/global.js"
    ],
    "recursive": true,
    "timeout": 30000,
    "color": true,
    "extension": [
        "js", "cjs", "mjs"
    ],
    "inline-diffs": false,
    "ui": "bdd",
    "exit": true
}