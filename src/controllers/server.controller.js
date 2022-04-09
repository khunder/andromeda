
// const EngineService = require("../modules/engine/engine.service");
// const  AndromedaLogger = require("../config/andromeda-logger");
// const fs = require("fs");
// const Logger = new AndromedaLogger();
// let BPMNModdle= require('bpmn-moddle')
// const Utils = require("../utils/utils");
// const WorkflowParsingContext = require("../model/parsing/workflow.parsing.context");

import EngineService from "../modules/engine/engine.service.js";
import Utils from "../utils/utils.js";
import * as fs from "fs";

class ServerController {

    static compile = async (req, reply) => {
        if(!req.files || req.files.length === 0){
            throw new Error("at least a bpmn file must be specified");
        }
        if(!req.body.deploymentId){
            throw new Error("DeploymentId must be specified");
        }
        try {
            let fileContents = [];
            for(let fileIndex in req.files){
                fileContents.push(fs.readFileSync(req.files[fileIndex].path, {encoding: 'utf8'}));
            }
            let ctx = await Utils.prepareContainerContext(fileContents, req.body.deploymentId);
            await new EngineService().generateContainer(ctx);
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

export default ServerController