const serverController = require("../controllers/server.controller");
const Config  = require("../config/config");
// import {constants} from "../config/constants.js";
const constants = require('../config/constants')

function route (fastify, opts, next) {
    if(Config.getInstance().activateModules.filter(e=> e === constants.SERVER).length > 0){
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
    }


    next();
}

module.exports= route;