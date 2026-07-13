import {Config} from "../config/config.js";
import constants from "../config/constants.js";
import GalaxyController from "../modules/galaxy/controllers/galaxy.controller.js";
import {AndromedaLogger} from "../config/andromeda-logger.js";
const Logger = new AndromedaLogger();

function route (fastify, opts, next) {
    Logger.info(`Activating Galaxy module routes`);
    fastify.route({ method: 'POST', url: '/galaxy/heartbeat', handler: GalaxyController.heartbeat })
    fastify.route({ method: 'GET', url: '/galaxy/containers', handler: GalaxyController.listContainers })
    fastify.route({ method: 'POST', url: '/galaxy/clear', handler: GalaxyController.clearRegistry })
    next();
}

export default route
