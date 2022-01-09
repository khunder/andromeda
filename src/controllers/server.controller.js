
const ContainerContext = require("../model/container.context");
const EngineService = require("../modules/engine/engine.service");
const  AndromedaLogger = require("../config/andromeda-logger");
const fs = require("fs");
const Logger = new AndromedaLogger();
let BPMNModdle= require('bpmn-moddle')
const Utils = require("../utils/utils");

class ServerController {

    static compile = async (req, reply) => {
        try {


            let ctx = await Utils.prepareContainerContext(req.file.path);
            await new EngineService().generateContainer( ctx);
            return {};
        } catch (err) {
            const returnError = new Error();
            returnError.statusCode = 500;
            returnError.message = err;
            returnError.stack=err;
            throw returnError;
        }
    }

}

module.exports = ServerController