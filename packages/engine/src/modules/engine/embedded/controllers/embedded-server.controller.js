

import EngineService from "../../engine.service.js";
import Utils from "../../../../utils/utils.js";
import * as fs from "fs";
import {EmbeddedContainerService} from "../embedded.containers.service.js";

class EmbeddedServerController {


    static runEmbeddedContainer = async (req, reply) => {

        if(!req.body.deploymentId){
            throw new Error("DeploymentId must be specified");
        }
        const deploymentId =req.body.deploymentId
        // form fields arrive as strings; only an explicit "false" opts into standalone/lone-wolf mode
        const withGalaxy = req.body.withGalaxy !== 'false' && req.body.withGalaxy !== false;
        try {
            await EmbeddedContainerService.startEmbeddedContainer(deploymentId, {withGalaxy});
            return {};
        } catch (err) {
            const returnError = new Error();
            returnError.statusCode = 500;
            returnError.message = err;
            returnError.stack=err;
            throw returnError;
        }
    }

    static stopEmbeddedContainer = async (req, reply) => {

        if(!req.body.deploymentId){
            throw new Error("DeploymentId must be specified");
        }
        if(!req.body.port){
            throw new Error("port must be specified");
        }
        const deploymentId = req.body.deploymentId
        const port = req.body.port
        try {
            await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, port);
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

export default EmbeddedServerController