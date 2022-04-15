import {AndromedaLogger} from "../../../../config/andromeda-logger.js";

const Logger = new AndromedaLogger();
class ScriptTaskNodeProcessor {
    static type = "bpmn:ScriptTask"

    /**
     *
     * @param currentNode : ScriptTask
     * @param workflowCodegenContext : WorkflowCodegenContext
     * @param containerParsingContext : ContainerParsingContext
     * @returns {{name: *, id, type, body: *}}
     */
    process(currentNode, workflowCodegenContext, containerParsingContext){

        Logger.info(`processing script event`);
        const nodeContext = {
            id: currentNode.id,
            type: currentNode.$type,
            name: currentNode.name || currentNode.id,
            body: currentNode.script,
        };


        return nodeContext;

    }
}

export default ScriptTaskNodeProcessor;