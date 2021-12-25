import * as serverController from "../controllers/server.controller.js";

export default function (fastify, opts, next) {

    fastify.route(
        {
            schema:{
              tags:[ "Engine" ],
                description: "Compile BPMN file",
                summary: "Compile BPMN file",
            },

            method: 'GET',
            url: '/api/compile',
            handler: serverController.compile
        }
    )


    next();
}