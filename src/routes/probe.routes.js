
function route (fastify, opts, next) {
    fastify.route(
        {

            method: 'GET',
            url: '/live',
            handler: () => {}
        }
    )

    fastify.route(
        {
            method: 'GET',
            url: '/ready',
            handler: () => {}
        }
    )
    next();
}

module.exports = route;