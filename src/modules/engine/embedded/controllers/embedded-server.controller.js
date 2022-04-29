

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

export default EmbeddedServerController