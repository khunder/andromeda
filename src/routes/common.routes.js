import * as serverController from "../controllers/server.controller.js";

export default function (fastify, opts, next) {

    fastify.route(
        {
            schema:{
                description: "redirect route to /api",
                summary: "redirect route to /api",
            },
            method: 'GET',
            url: '/',
            handler: (req, res)=> {res.redirect("/api")}
        }
    )


    next();
}