

import EngineService from "../modules/engine/engine.service.js";
import Utils from "../utils/utils.js";
import * as fs from "fs";
import {EmbeddedContainerService} from "../modules/engine/embedded.containers.service.js";

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


    static runEmbeddedContainer = async (req, reply) => {

        if(!req.body.deploymentId){
            throw new Error("DeploymentId must be specified");
        }
        const deploymentId =req.body.deploymentId
        try {

            await new EmbeddedContainerService().startEmbeddedContainer(deploymentId, {});
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