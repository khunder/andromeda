import {EmbeddedContainerModel} from "./embedded.container.model.js";
import utils, {Utils} from "../../../utils/utils.js";
import path from "path";
import fs from "fs";
import forever from "forever";
import {Config} from "../../../config/config.js";

import {AndromedaLogger} from "../../../config/andromeda-logger.js";
import http from "http";
const Logger = new AndromedaLogger();

export class EmbeddedContainerService {

    static containers= [];
    static portOffset = 10000
    static maxAttemptsRange = 100;

    static allocatedPorts = [];
    static isPortFree = port =>
        new Promise(resolve => {
            const server = http
                .createServer()
                .listen(port, () => {
                    server.close()
                    Logger.trace(`port ${port} is free`);
                    resolve(true)
                })
                .on('error', () => {
                    Logger.trace(`port ${port} is not free`);
                    resolve(false)
                })
        });

    static async AllocatePortInRange(containerPort) {
        if(containerPort){
            if(this.allocatedPorts.includes(containerPort)){
                if(! await this.isPortFree(containerPort)){
                    throw new Error(`cannot allocate port ${containerPort}, already allocated`);
                }
            }
            this.allocatedPorts.push(containerPort);
            return containerPort;
        }

        let attempts = 0;


        let port = EmbeddedContainerService.portOffset;
        while (attempts < EmbeddedContainerService.maxAttemptsRange ){
            if(!this.allocatedPorts.includes(attempts+EmbeddedContainerService.portOffset)){
                port = EmbeddedContainerService.portOffset+ attempts;
                Logger.debug(`trying to allocate port ${port}`);
                Logger.debug(`pushing  port ${port} to port list `);
                this.allocatedPorts.push(port)
                if(await this.isPortFree(port)){
                    return parseInt(String(port));
                }
            }
            attempts++;
        }
        if(attempts === EmbeddedContainerService.maxAttemptsRange ){
            throw `cannot allocate port ${port} after ${(EmbeddedContainerService.maxAttemptsRange)} attempts`;
        }
    }


    static async startEmbeddedContainer(deploymentId, options) {
        let allocatedPort = await this.allocatePort(options);

        Logger.info(`starting container on port ${allocatedPort}`)
        let deploymentPath = `./deployments/${deploymentId}`;

        this.deleteEmbeddedContainerPidFile(deploymentPath, allocatedPort);

        let childProcess;
        let executor = '';
        let args = []
        executor = path.join(process.cwd(), "deployments", deploymentId, "/bootstrap.js")
        try {
            childProcess = forever.start(executor, {
                max: 1,
                silent: false,
                killTree: true,
                env: {
                    containerPort: String(allocatedPort),
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
            const daemon = await import("../embedded/embedded.sidecar.daemon.service.js");
            daemon.EmbeddedSidecarDaemonService.watchContainer(childProcess.child.pid)
        }

        await this.waitForEmbeddedContainerStart(deploymentPath, deploymentId, allocatedPort);
        return allocatedPort;
    }

    static deleteEmbeddedContainerPidFile(deploymentPath, port) {
        const basePath = path.join(process.cwd(), "deployments", deploymentPath)
        const pidPath= path.join(basePath , `pid_${port}`)
        if (fs.existsSync(pidPath)) {
            Logger.debug(`deleteEmbeddedContainerPidFile:: Found pid file`)
            try {
                Logger.debug(`deleteEmbeddedContainerPidFile:: deleting pid file`)
                fs.unlinkSync(pidPath)
            } catch (err) {
                Logger.error(err)
            }
        }else{
            Logger.debug(`deleteEmbeddedContainerPidFile:: pid file NOT FOUND at ${pidPath}`)
        }
    }

    static async allocatePort(options) {
        if (options && options.port) {
            return options.port
        } else {
            return await EmbeddedContainerService.AllocatePortInRange();
        }
    }

    /**
     *
     * @param {string} deploymentPath
     * @param {string} deploymentId
     * @param {number} allocatedPort
     * @returns {Promise<void>}
     */
    static async waitForEmbeddedContainerStart(deploymentPath, deploymentId, allocatedPort) {
        const runContainer = async () => {
            if (fs.existsSync(deploymentPath + `/pid_${allocatedPort}`)) {
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
        for (let i = 0; i < numberOfAttempts; ++i) {
            if (await runContainer()) {
                break;
            }
            if (i === numberOfAttempts - 1) {
                Logger.error(`Cannot start embedded container:${deploymentId} Max number of attempts reached, on port ${allocatedPort}`);
                await this.stopEmbeddedContainer(deploymentId, allocatedPort)
                throw `cannot start embedded container`;
            }
        }
    }

    static async stopEmbeddedContainer(deploymentId, port) {
        if(!port){
            Logger.error(`to stop embedded container port must not specified `)
            throw new Error(`to stop embedded container port must not specified `)
        }
        Logger.debug(`stopEmbeddedContainer :: ${deploymentId}`)
        EmbeddedContainerService.containers.forEach(e=>{
            if(e.model.deploymentId === deploymentId){
                Logger.debug(`stopEmbeddedContainer :: with pid ${e.model.pid}`)
                EmbeddedContainerService.deleteEmbeddedContainerPidFile(deploymentId, port);
                forever.kill(e.model.pid)
            }
        });
    }
}