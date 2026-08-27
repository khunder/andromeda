import {v4} from "uuid";
import  {AndromedaLogger} from "../../config/andromeda-logger.js";
import ContainerSocket from "./container-socket.js";
import fs from "fs";
import path from "path";
const Logger = new AndromedaLogger();

let instance;
export class ContainerService{

    static containerId = v4();
    processInstances= {}

    // deployment-metadata.json is written once at generation time (see
    // EngineService.writeDeploymentMetadata) next to this container's own
    // package.json - loaded once here since it never changes for the
    // lifetime of this container.
    static deploymentId;
    static version;
    static processDefs = [];

    constructor() {
    }

    static getInstance(){
        if(!instance){
            Logger.info(`Creating new Container Service: ${ContainerService.containerId}`)
            instance = new ContainerService();
        }
        return instance;
    }

    static async init() {
        Logger.info(`Init Container module`)
        ContainerService.loadDeploymentMetadata();
        await ContainerSocket.init();
    }

    static loadDeploymentMetadata() {
        try {
            const metadata = JSON.parse(fs.readFileSync(path.join(process.cwd(), "deployment-metadata.json"), {encoding: "utf8"}));
            ContainerService.deploymentId = metadata.deploymentId;
            ContainerService.version = metadata.version;
            ContainerService.processDefs = metadata.processDefs || [];
        } catch (e) {
            // older deployment folder predating this file, or run outside a generated deployment - degrade to defaults
        }
    }

    // Describes this running container: its base id, version, and the
    // process defs it serves - see GET /api/containers (probe.routes.js.snjk).
    static getInfo() {
        return {
            id: ContainerService.deploymentId,
            deploymentId: process.env.deploymentId,
            version: ContainerService.version,
            processDefs: ContainerService.processDefs
        };
    }

    // track the process instance until
    lock(processInstance){
        Logger.info(`Locking process instance(${processInstance})`)
        this.processInstances[processInstance.processInstanceId]= processInstance
        // call process instance repository to lock process instance
    }

    unlock(processInstance){
        Logger.info(`UnLocking process instance(${processInstance})`)
        delete processInstances[processInstance.processInstanceId]
        // call process instance repository to unlock process instance
    }

}


export default ContainerService;