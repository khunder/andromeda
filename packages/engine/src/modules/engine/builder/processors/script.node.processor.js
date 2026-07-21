import {AndromedaLogger} from "../../../../config/andromeda-logger.js";

const Logger = new AndromedaLogger();
class ScriptTaskNodeProcessor {
    static type = "bpmn:ScriptTask"

    /**
     *
     * @param currentNode : ScriptTask
     * @param workflowCodegenContext : WorkflowCodegenContext
     * @param containerParsingContext : ContainerParsingContext
     * @returns {NodeContext}
     */
    process(currentNode, workflowCodegenContext, containerParsingContext){

        Logger.info(`processing script event`);
        /**
         * @type {NodeContext}
         */
        const nodeContext = {
            id: currentNode.id,
            type: currentNode.$type,
            name: currentNode.name || currentNode.id,
            body: currentNode.script,
            executeInWorker: true,
        };

        // if we want to customize the script event flow
        workflowCodegenContext.serviceClass.addMember(`async customizeScriptTaskFlowEvent(flowEvent){
            flowEvent.status = 1
        }`)


        return nodeContext;

    }
}

export default ScriptTaskNodeProcessor;
