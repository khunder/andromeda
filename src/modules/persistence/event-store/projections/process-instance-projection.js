import AndromedaLogger from "../../../../config/andromeda-logger.js";

const Logger = new AndromedaLogger();
export class ProcessInstanceProjection {


    process(event){
        if(event.type  === "CLOSE_PROCESS_INSTANCE"){
            Logger.warn("updating process instance")
        }
        if(event.type  === "CREATE_PROCESS_INSTANCE"){
            Logger.warn("creating new process instance")
        }

        // console.dir(event)
    }
}