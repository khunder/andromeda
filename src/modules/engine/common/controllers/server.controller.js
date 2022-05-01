

import EngineService from "../../engine.service.js";
import Utils from "../../../../utils/utils.js";
import * as fs from "fs";

class ServerController {

    static compile = async (req, reply) => {
        if(!req.files || req.files.length === 0){
            throw new Error("at least a bpmn file must be specified");
        }
        if(!req.body.deploymentId){
            throw new Error("deploymentId must be specified");
        }

        if(!req.body.deploymentId){
            throw new Error("deploymentId must be specified");
        }
        //
        let includeGalaxyModule;
        if(req.body.includeGalaxyModule){
            includeGalaxyModule = req.body.includeGalaxyModule === "true";
        }else{
            includeGalaxyModule = false;
        }

        try {
            let fileContents = [];
            for(let fileIndex in req.files){
                fileContents.push(fs.readFileSync(req.files[fileIndex].path, {encoding: 'utf8'}));
            }
            const containerParsingContext = await Utils.prepareContainerContext(fileContents, req.body.deploymentId);
            containerParsingContext.includeGalaxyModule = includeGalaxyModule;

            await new EngineService().generateContainer(containerParsingContext);
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