import {Config} from "../config/config.js"
import constants from "../config/constants.js"

function route (fastify, opts, next) {

    if(Config.getInstance().activateModules.filter(e=> e === constants.PERSISTENCE).length === 0){
        return next();
    }
    fastify.route(
        {
            method: 'GET',
            url: '/persist',
            handler: () => {}
        }
    )

    next();
}

export default route;