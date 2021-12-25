import * as serverController from "../controllers/server.controller.js";

export default function (fastify, opts, next) {
    fastify.route(
        {
            schema:  {
                description: 'Liveliness probe (health check)',
                tags: ['Startup probe'],
                summary: 'Liveliness probe (health check)',
                response: {
                    200: {
                        description: 'Successful response',
                        type: 'string',
                        example: {"uptime": "number"}
                    },
                }
            },
            method: 'GET',
            url: '/live',
            handler: () => {}
        }
    )

    fastify.route(
        {
            schema:  {
                description: 'Readiness probe, app is ready to accept requests, initialization phase is completed...',
                tags: ['Startup probe'],
                summary: 'Readiness probe, app is ready to accept requests',
                response: {
                    200: {
                        description: 'Successful response',
                        type: 'string',
                        example: {"status": "..."}
                    },
                    503: {
                        type: 'null',
                        description: 'Service Unavailable'
                    }
                }
            },
            method: 'GET',
            url: '/ready',
            handler: () => {}
        }
    )
    next();
}