import {AndromedaLogger} from "../../../../config/andromeda-logger.js";

const Logger = new AndromedaLogger();
class CatchEventNodeProcessor {
    static type = "bpmn:CatchEvent"

    /**
     *
     * @param currentNode
     * @param workflowCodegenContext : WorkflowCodegenContext
     * @param containerParsingContext : ContainerParsingContext
     * @returns {NodeContext}
     */
    process(currentNode, workflowCodegenContext, containerParsingContext){

        Logger.debug(`processing catch event`);
        /**
         * @type {NodeContext}
         */
        const nodeContext = {
            id: currentNode.id,
            type: currentNode.$type,
            name: currentNode.name || currentNode.id,
            args: {twoPhaseComponent: true},
            body: currentNode.script,
        };


        return nodeContext;

    }
}

export default CatchEventNodeProcessor;