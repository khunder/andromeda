
import fastify from "fastify";
import {routes} from "./routes/routes.js";
import fastify_swagger from "fastify-swagger";

import {Engine} from "./engine.js";
import {options} from "./config/swagger.js";



describe("Engine lifecycle", () => {
    let server;
    beforeAll(()=> {
        server = fastify({
            logger: true
        })
        server.register(fastify_swagger, options)

        routes.forEach((route, index) => {
            server.route(route)
        })
    });

    test('Start Engine', async () => {
        await new Engine().start(server, 5000).then(r => {
        });
    })

    test('Stop Engine', async () => {
        await new Engine().stop(server)
    })

    test('Drain Engine', (done) => {
        done()
    })

})