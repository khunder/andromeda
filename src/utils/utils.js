const Config = require("../config/config");
const fs = require("fs");
const BPMNModdle = require("bpmn-moddle");
const  ContainerParsingContext = require("../model/parsing/container.parsing.context");
const  WorkflowParsingContext = require("../model/parsing/workflow.parsing.context");
const sanitize = require("./sanitize");
class Utils{
    static moduleIsActive(module) {
        return Config.getInstance().activateModules.filter(e => e === module).length > 0;

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

module.exports = Utils;