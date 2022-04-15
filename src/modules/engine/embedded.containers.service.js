import {EmbeddedContainerModel} from "./embedded.container.model.js";
import utils, {Utils} from "../../utils/utils.js";
import path from "path";
import fs from "fs";
import forever from "forever";
import {Config} from "../../config/config.js";
import {LocalSideCarDaemonService} from "./local.side-car.daemon.service.js";
import {AndromedaLogger} from "../../config/andromeda-logger.js";
const Logger = new AndromedaLogger();

export class EmbeddedContainerService {

    static containers= [];


    async startEmbeddedContainer(deploymentId, options) {
        let allocatedPort = await this.allocatePort(options);

        Logger.info(`starting container on port ${allocatedPort}`)
        let deploymentPath = `./deployments/${deploymentId}`;

        this.deleteEmbeddedContainerPidFile(deploymentPath);

        let childProcess;
        let executor = '';
        let args = []
        executor = path.join(process.cwd(), "deployments", deploymentId, "/app.js")
        try {
            childProcess = forever.start(executor, {
                max: 1,
                silent: false,
                killTree: true,
                env: {
                    container_port: String(allocatedPort),
                    mongoDbUri: Config.getInstance().mongoDbUri,
                    deploymentId: deploymentId
                },
                cwd: deploymentPath,
                args: args
            });

        } catch (e) {
            Logger.error(e)
        }


        if (!childProcess || !childProcess.child || !childProcess.child.pid) {
            throw new Error(`cannot start child process`);
        }

        Logger.trace(`storing PID= ${childProcess.child.pid}, for process ${deploymentId}, on port ${allocatedPort}`)
        EmbeddedContainerService.containers.push({deploymentId, model: new EmbeddedContainerModel(childProcess.child.pid, allocatedPort, deploymentId)});

        if (Config.getInstance().isLocalMode) {
            LocalSideCarDaemonService.watchContainer(childProcess.child.pid)
        }

        await this.waitForEmbeddedContainerStart(deploymentPath, deploymentId, allocatedPort);
        return allocatedPort;
    }

    deleteEmbeddedContainerPidFile(deploymentPath) {
        if (fs.existsSync(`${deploymentPath}/pid`)) {
            try {
                fs.unlinkSync(`${deploymentPath}/pid`)
            } catch (err) {
                Logger.error(err)
            }
        }
    }

    async allocatePort(options) {
        if (options && options.port) {
            return options.port
        } else {
            return await utils.AllocatePortInRange();
        }
    }

    async waitForEmbeddedContainerStart(deploymentPath, deploymentId, allocatedPort) {
        const runContainer = async () => {
            if (fs.existsSync(deploymentPath + "/pid")) {
                Logger.info(`Found process id (PID), for process ${deploymentId}, on port ${allocatedPort}`)
                return true;
            } else {
                Logger.trace(`waiting for the container ${deploymentId} to connect on port ${allocatedPort}`)
                await Utils.sleep(1000)
                return false;
            }
        };

        let numberOfAttempts = 300;
        Logger.info(`Waiting for the embedded container ${deploymentId} to connect on port ${allocatedPort}`)
        for (let i = 0; i < numberOfAttempts; i++) {
            if (await runContainer()) {
                break;
            }
            if (i === numberOfAttempts - 1) {
                Logger.error(`Cannot start embedded container:${deploymentId} Max number of attempts reached, on port ${allocatedPort}`);
                await this.stopEmbeddedContainer(deploymentId)
                throw `cannot start embedded container`;
            }
        }
    }

    async stopEmbeddedContainer(deploymentId) {
        EmbeddedContainerService.containers.forEach(e=>{
            if(e.model.deploymentId === deploymentId){
                forever.kill(e.model.pid)
            }
        })
    }
}