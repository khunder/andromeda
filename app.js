
const utils = require("./src/utils/utils");
const constants = require("./src/config/constants");



if (utils.moduleIsActive(constants.SERVER)) {
    let Engine = require('./src/modules/engine/engine')
    module.exports.server = new Engine().start("127.0.0.1", 5000)
}

if (utils.moduleIsActive(constants.PERSISTENCE)) {
    let Persistence = require('./src/modules/persistence/persistence')
    module.exports.persistnce = new Persistence().start();
}







