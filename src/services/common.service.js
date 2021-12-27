
const fs = require( 'fs');
const shell = require( 'shelljs');
const Config = require("../config/config");
const  AndromedaLogger = require("../config/andromeda-logger");

const Logger = new AndromedaLogger();

class CommonService {

    constructor() {
    }

    getTemporaryFolder() {
        let tempPath = Config.getInstance().tempPath;
        if (!tempPath) {
            tempPath = `${process.cwd()}/temp/uploads`;
        }
        return tempPath;
    }

    createTemporaryFolders() {
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

    getDeploymentPath() {
        let deploymentPath = Config.getInstance().deploymentPath;
        if (!deploymentPath) {
            deploymentPath = `${process.cwd()}/${Config.getInstance().deploymentPath}`;
        }
        return deploymentPath;
    }

    createDeploymentFolder() {
        const deploymentPath = this.getDeploymentPath();
        if (!fs.existsSync(deploymentPath)) {
            Logger.debug(
                `Trying to create deployment folder in path: ${deploymentPath}`,
            );
            shell.mkdir('-p', deploymentPath);
        }
    }
}

module.exports = CommonService