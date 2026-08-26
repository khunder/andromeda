import {v4} from "uuid";
import  {AndromedaLogger} from "../../config/andromeda-logger.js";
import ContainerSocket from "./container-socket.js";
import {Config} from "../../config/config.js";
import {PersistenceGateway} from "../persistence/persistence-gateway.js";
const Logger = new AndromedaLogger();

// how often this container registers itself as running (see registerHeartbeat())
const HEARTBEAT_INTERVAL_MS = 10_000;

let instance;
export class ContainerService{

    static containerId = v4();
    processInstances= {}

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
        await ContainerSocket.init();
        await ContainerService.registerHeartbeat();
        setInterval(ContainerService.registerHeartbeat, HEARTBEAT_INTERVAL_MS);
    }

    // upserts this container replica's own registration row - see
    // ContainerRegistrationRepository for why (deploymentId, version,
    // containerId) as the unique key keeps concurrent replicas from racing
    // on the same row
    static async registerHeartbeat() {
        try {
            await PersistenceGateway.registerContainerHeartbeat({
                deploymentId: Config.getInstance().deploymentId,
                version: Config.getInstance().version,
                containerId: ContainerService.containerId
            });
        } catch (e) {
            Logger.error(`failed to register container heartbeat: ${e}`);
        }
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