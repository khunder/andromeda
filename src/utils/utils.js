import {Config} from "../config/config.js";

import  ContainerParsingContext from "../model/parsing/container.parsing.context.js"
import  WorkflowParsingContext  from "../model/parsing/workflow.parsing.context.js";
import BPMNModdle from "bpmn-moddle";
import {AndromedaLogger} from "../config/andromeda-logger.js";
const Logger = new AndromedaLogger();

export class Utils{
    static moduleIsActive(module) {
        return Config.getInstance().activateModules.filter(e => e === module).length > 0;

    }


    static sleep(ms) {

        return new Promise((resolve, reject) => {
            setTimeout(resolve, ms, [])
        })
    }

    static normalizeProcessPrefixWithoutVersion(str) {
        const result = str;
        const regex = /(\w+)(-[vV][0-9]+\.[0-9]+)/;
        return result.replace(regex, `$1`);
    }

    static upperFirstChar(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    static async prepareContainerContext(filesContent, deploymentId) {
        const ctx = new ContainerParsingContext({
            isTestContainer: false,
        });
        for(let index in filesContent){
            const workflowParsingContext = new WorkflowParsingContext()
            workflowParsingContext.bpmnContent = filesContent[index]
            workflowParsingContext.model = await new BPMNModdle().fromXML(workflowParsingContext.bpmnContent);
            workflowParsingContext.processPrefix= this.upperFirstChar(this.normalizeProcessPrefixWithoutVersion(workflowParsingContext.model.rootElement.id))
            ctx.workflowParsingContext.push(workflowParsingContext);
        }
        ctx.deploymentId = deploymentId;
        // by default activate web and persistence modules
        ctx.includePersistenceModule = true;
        ctx.includeWebModule = true;

        return ctx;
    }

    // static getDeploymentId(model) {
    //     if(!model){
    //         return new Error(`model should not be null`);
    //     }
    //     return sanitize(model.rootElement.id);
    // }

    // normalizeProcessDefWithoutVersion(processDef) {
    //     const result = processDef;
    //     const regex = /(\w+)(-[vV][0-9]+\.[0-9]+)/;
    //     return result.replace(regex, `$1`);
    // }

    /**
     * Used to encapsulate exceptions in
     * @param call
     * @returns {Promise<*>}
     */
    static getError = async (call) => {
        try {
            await call();
        } catch (error) {
            return error;
        }
    };

}

export  default Utils