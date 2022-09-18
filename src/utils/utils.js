import {Config} from "../config/config.js";

import  ContainerParsingContext from "../model/parsing/container.parsing.context.js"
import  WorkflowParsingContext  from "../model/parsing/workflow.parsing.context.js";
import BPMNModdle from "bpmn-moddle";
import {AndromedaLogger} from "../config/andromeda-logger.js";
const Logger = new AndromedaLogger();
import path from 'path';
import {fileURLToPath} from 'url';
import {config as LoadDotEnvConfig} from "dotenv"

export class Utils{
    static moduleIsActive(module) {
        return Config.getInstance().activateModules.filter(e => e === module).length > 0;

    }

    static getDeploymentPath(ctx) {
        return path.join(Config.getInstance().deploymentPath, ctx.deploymentId);
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

    static getSocketPath() {
        return path.join(process.cwd(),`./.pid_${Config.getInstance().port}`);
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

    static isObject(val) {
        return (typeof val === 'object');
    }

    static loadEnvVariables(env) {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        let envVariablesPath;
        if(env && env.toString().toUpperCase() === "TEST"){
            envVariablesPath = path.join(__dirname, '../../test', '.env' );
        }else{
            envVariablesPath = path.join(__dirname, '../..', '.env' );
        }
        Logger.info(`Loading Env variables from ${envVariablesPath}`)
        LoadDotEnvConfig({path: envVariablesPath});
    }
}

export default Utils