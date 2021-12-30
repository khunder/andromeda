const Config = require("../config/config");
const constants = require("../config/constants");

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

module.exports = route;