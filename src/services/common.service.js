import {AndromedaLogger} from "../config/andromeda-logger.js";
import {Config} from "../config/config.js";
import {Shell} from "./shell.js";
import fs from "fs";
import path from "path";


const Logger = new AndromedaLogger();

class CommonService {

    static async createTemporaryFolders() {

        const tempPath = Config.getInstance().tempPath;
        const uploadFolder = path.join(tempPath, "bpmns");
        const filesFolder = path.join(tempPath, "files");
        if (!fs.existsSync(uploadFolder)) {
            Logger.debug(
                `Trying to create temporary upload folder in path: ${uploadFolder}`,
            );
            Shell.mkdir( uploadFolder);
        }
        if (!fs.existsSync(filesFolder)) {
            Logger.debug(
                `Trying to create temporary files folder in path: ${filesFolder}`,
            );
            Shell.mkdir( filesFolder);
        }
    }


    static createDeploymentFolder() {
        const deploymentPath = Config.getInstance().deploymentPath;
        if (!fs.existsSync(deploymentPath)) {
            Logger.debug(
                `Trying to create deployment folder in path: ${deploymentPath}`,
            );
            Shell.mkdir( deploymentPath);
        }
    }
}

export default CommonService