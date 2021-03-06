import {AndromedaLogger} from "../../../../config/andromeda-logger.js";

const Logger = new AndromedaLogger();
class StartNodeProcessor {
    static type = "bpmn:StartEvent"
    process(currentNode, workflowCodegenContext, containerParsingContext){

        Logger.info(`processing start event`);
        const nodeContext = {
            id: currentNode.id,
            type: currentNode.$type,
            name: currentNode.name || currentNode.id,
            body: ``,
        };

        const bootstrapMethod =workflowCodegenContext.serviceClass.getMethodOrThrow('bootstrap');
        bootstrapMethod.addStatements(
            `this.fn_${currentNode.id}()`,
        );
        return nodeContext;

    }
}

export default StartNodeProcessor;