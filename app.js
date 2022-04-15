
import Utils from "./src/utils/utils.js";
import constants from "./src/config/constants.js";
import {AndromedaLogger} from "./src/config/andromeda-logger.js";
import {Config} from "./src/config/config.js";

const Logger = new AndromedaLogger();

let modules=[]

async function executePromisesSequentially(modulePromisesArr) {
    for (let i=0; i < modulePromisesArr.length; i++) {
         await modulePromisesArr[i]();
    }
}

if (Utils.moduleIsActive(constants.PERSISTENCE)) {
        try{
            let Persistence = await import('./src/modules/persistence/persistence.module.js')
            modules.push( Persistence.PersistenceModule.init)
        }catch (e) {
            Logger.error(e)
        }
}

if (Utils.moduleIsActive(constants.SERVER)) {
        try{
            let Engine = await import ('./src/modules/engine/engine.module.js')
            let engineModuleInstance = new Engine.EngineModule("127.0.0.1", 5000);
            modules.push(engineModuleInstance.start.bind(engineModuleInstance));
        }catch (e) {
            Logger.error(e)
        }

}

await executePromisesSequentially(modules);








