// Require the fastify framework and instantiate it
import fastify from "fastify";


// Import Routes
import {routes} from "./routes/routes.js";
import fastify_swagger from "fastify-swagger";

import {Engine} from "./engine.js";
import {options} from "./config/swagger.js";


const server = fastify({
  logger: true
})
// Register Swagger
server.register(fastify_swagger, options)


// Loop over each route
routes.forEach((route, index) => {
  server.route(route)
})



new Engine().start(server, 5000).then(r => {});

