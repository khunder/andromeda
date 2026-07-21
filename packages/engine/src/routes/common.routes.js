


function route (fastify, opts, next) {

    fastify.route(
        {
            method: 'GET',
            url: '/',
            handler: (req, res)=> {res.redirect("/api")}
        }
    )


    next();
}

export default route