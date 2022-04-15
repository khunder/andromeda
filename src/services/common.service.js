

import {AndromedaLogger} from "../config/andromeda-logger.js";
import {Config} from "../config/config.js";

const Logger = new AndromedaLogger();

class CommonService {

    constructor() {
    }

    static getTemporaryFolder() {
        let tempPath = Config.getInstance().tempPath;
        if (!tempPath) {
            tempPath = `${process.cwd()}/temp/uploads`;
        }
        return tempPath;
    }

    static createTemporaryFolders() {
        const tempPath = this.getTemporaryFolder();

        const uploadFolder = `${tempPath}/bpmns`;
        const filesFolder = `${tempPath}/files`;
        if (!fs.existsSync(uploadFolder)) {
            Logger.debug(
                `Trying to create temporary upload folder in path: ${uploadFolder}`,
            );
            shell.mkdir('-p', uploadFolder);
        }
        if (!fs.existsSync(filesFolder)) {
            Logger.debug(
                `Trying to create temporary files folder in path: ${filesFolder}`,
            );
            shell.mkdir('-p', filesFolder);
        }
    }

    static getDeploymentPath() {
        let deploymentPath = Config.getInstance().deploymentPath;
        if (!deploymentPath) {
            deploymentPath = `${process.cwd()}/${Config.getInstance().deploymentPath}`;
        }
        return deploymentPath;
    }

    static createDeploymentFolder() {
        const deploymentPath = this.getDeploymentPath();
        if (!fs.existsSync(deploymentPath)) {
            Logger.debug(
                `Trying to create deployment folder in path: ${deploymentPath}`,
            );
            shell.mkdir('-p', deploymentPath);
        }
    }
}

export default CommonService