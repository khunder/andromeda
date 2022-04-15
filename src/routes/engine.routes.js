
import  multer from "fastify-multer";
import serverController from "../controllers/server.controller.js";
import {Config} from "../config/config.js";
import constants from "../config/constants.js";

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

        fastify.route(
            {
                method: 'POST',
                preHandler: upload.array('bpmnFile'),
                url: '/api/run-embedded',
                handler: serverController.runEmbeddedContainer
            }
        )
    }


    next();
}

export default  route