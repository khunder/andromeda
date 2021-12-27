const Config = require("./config/config");
class Utils{
    static moduleIsActive(module) {
        return Config.getInstance().activateModules.filter(e => e === module).length > 0;

    }

}

module.exports = Utils;