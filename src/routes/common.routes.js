


function route (fastify, opts, next) {

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

module.exports = route