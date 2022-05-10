import {v4} from "uuid";
import  {AndromedaLogger} from "../../config/andromeda-logger.js";
const Logger = new AndromedaLogger();

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

    static init(){
        Logger.info(`Init Container module`)
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