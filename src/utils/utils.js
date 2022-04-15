import {Config} from "../config/config.js";

import  ContainerParsingContext from "../model/parsing/container.parsing.context.js"
import  WorkflowParsingContext  from "../model/parsing/workflow.parsing.context.js";
import   sanitize from "./sanitize.js";
import BPMNModdle from "bpmn-moddle";
import {AndromedaLogger} from "../config/andromeda-logger.js";
const Logger = new AndromedaLogger();
import http from "http";

export class Utils{
    static moduleIsActive(module) {
        return Config.getInstance().activateModules.filter(e => e === module).length > 0;

    }

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
        let maxAttemptsRange = 100;


        const portOffset = 10000
        let port = portOffset;
        while (attempts < maxAttemptsRange ){
            if(!this.allocatedPorts.includes(attempts+portOffset)){
                port = portOffset+ attempts;
                Logger.debug(`trying to allocate port ${port}`);
                Logger.debug(`pushing  port ${port} to port list `);
                this.allocatedPorts.push(port)
                if(await this.isPortFree(port)){
                    return parseInt(String(port));
                }
            }
            attempts++;
        }
        if(attempts === maxAttemptsRange ){
            throw `cannot allocate port in the range of ${maxAttemptsRange} `;
        }
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
            workflowParsingContext.model = await new BPMNModdle().fromXML(workflowParsingContext.bpmnContent, () => null);
            workflowParsingContext.processPrefix= this.upperFirstChar(this.normalizeProcessPrefixWithoutVersion(workflowParsingContext.model.rootElement.id))
            ctx.workflowParsingContext.push(workflowParsingContext);
        }
        ctx.deploymentId = deploymentId;

        return ctx;
    }

    static getDeploymentId(model) {
        if(!model){
            return new Error(`model should not be null`);
        }
        return sanitize(model.rootElement.id);
    }

    normalizeProcessDefWithoutVersion(processDef) {
        const result = processDef;
        const regex = /(\w+)(-[vV][0-9]+\.[0-9]+)/;
        return result.replace(regex, `$1`);
    }

}

export  default Utils