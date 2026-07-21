import  {AndromedaLogger} from "../../config/andromeda-logger.js";
const Logger = new AndromedaLogger();
import ContainerService from "./container.service.js"
import ContainerSocket from "./container-socket.js";

export class ContainerModule{


    async start(){
        const startTime = new Date().getUTCMilliseconds();
        await ContainerService.init();
        const startCompleted = new Date().getUTCMilliseconds();
        Logger.info(`Container started in ${startCompleted - startTime} ms`)

    }
}