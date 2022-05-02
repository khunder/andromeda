import {Config} from "../config/config.js";
import constants from "../config/constants.js";
import GalaxyController from "../modules/galaxy/controllers/galaxy.controller.js";
import {AndromedaLogger} from "../config/andromeda-logger.js";
const Logger = new AndromedaLogger();

function route (fastify, opts, next) {

    if(Config.getInstance().activateModules.filter(e=> e === constants.GALAXY).length > 0) {
        Logger.info(`Activating Galaxy module routes`);
        fastify.route(
            {
                method: 'GET',
                url: '/processinstance',
                handler: GalaxyController.getProcessInstances,
            }
        )
    }
    next();
}

export default route