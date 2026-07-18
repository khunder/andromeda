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
            // intentionally not awaited: bootstrap()/the /start response must
            // return immediately while the workflow runs in the background.
            // .catch() only ensures a failure is logged instead of vanishing
            // as an unhandled promise rejection.
            `this.fn_${currentNode.id}().catch((error) => { Logger.error(error); });`,
        );
        return nodeContext;

    }
}

export default StartNodeProcessor;