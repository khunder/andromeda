const Config = require("../config/config");
const constants = require("../config/constants");

function route (fastify, opts, next) {

    if(Config.getInstance().activateModules.filter(e=> e === constants.PERSISTENCE).length === 0){
        return next();
    }
    fastify.route(
        {
            schema:  {
                description: 'persist probe',
                tags: ['Persistence'],
                summary: 'persistence probe ',
                response: {
                    200: {
                        description: 'Successful response',
                        type: 'string',
                        example: {"persist": "number"}
                    },
                }
            },
            method: 'GET',
            url: '/persist',
            handler: () => {}
        }
    )

    next();
}

module.exports = route;