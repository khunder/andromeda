
const config = require('./.mocharc.cjs')
module.exports = {
    ...config,
    require: [  "test/init_integration.js"],
}