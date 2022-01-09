const serverController = require("../controllers/server.controller");
const Config  = require("../config/config");
const constants = require('../config/constants')
const multer = require("fastify-multer");
const upload = multer({ dest: '../uploads/' })

function route (fastify, opts, next) {
    if(Config.getInstance().activateModules.filter(e=> e === constants.SERVER).length > 0){
        fastify.route(
            {
                method: 'POST',
                preHandler: upload.array('bpmnFile'),
                url: '/api/compile',
                handler: serverController.compile
            }
        )
    }


    next();
}

module.exports= route;