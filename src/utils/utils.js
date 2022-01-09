const Config = require("../config/config");
const fs = require("fs");
const BPMNModdle = require("bpmn-moddle");
const ContainerContext = require("../model/container.context");
const sanitize = require("./sanitize");
class Utils{
    static moduleIsActive(module) {
        return Config.getInstance().activateModules.filter(e => e === module).length > 0;

    }


    static async prepareContainerContext(filePath) {
        const ctx = new ContainerContext({
            isTestContainer: false,
        });
        ctx.bpmnContent = fs.readFileSync(filePath, {encoding: 'utf8'})
        ctx.model = await new BPMNModdle().fromXML(ctx.bpmnContent, () => null);
        ctx.deploymentId = this.getDeploymentId(ctx.model);
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