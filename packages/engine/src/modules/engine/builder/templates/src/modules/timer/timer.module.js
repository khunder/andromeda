import {AndromedaLogger} from "../../config/andromeda-logger.js";
import {TimerService} from "./timer.service.js";

const Logger = new AndromedaLogger();

export class TimerModule {

    async start() {
        Logger.info(`Init Timer module`);
        await TimerService.init();
    }
}

export default TimerModule;
