import {Config} from "../config/config.js";
import constants from "../config/constants.js";
import commonServerController from "../modules/engine/common/controllers/server.controller.js";
import EmbeddedGalaxyController from "../modules/galaxy/embedded/controllers/embedded-galaxy.controller.js";
import {AndromedaLogger} from "../config/andromeda-logger.js";
const Logger = new AndromedaLogger();

function route (fastify, opts, next) {

    if(Config.getInstance().activateModules.filter(e=> e === constants.GALAXY).length > 0) {
        Logger.info(`---->`)
        fastify.route(
            {
                method: 'GET',
                url: '/processinstance',
                handler: EmbeddedGalaxyController.getProcessInstances,
            }
        )
    }
    next();
}

export default route