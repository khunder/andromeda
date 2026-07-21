import {AndromedaLogger} from "../../../config/andromeda-logger.js";

const Logger = new AndromedaLogger();
export class FakeNodeProcessor {
    static type = "bpmn:FakeActivity"
    process(currentNode, workflowCodegenContext, containerParsingContext){

        Logger.info(`processing fake event`);
        return {
            id: currentNode.id,
            type: currentNode.$type,
            name: currentNode.name || currentNode.id,
            body: ``,
        };

    }
}

export class FakeNodeProcessorWithoutNodeContext {
    static type = "bpmn:FakeActivityWithoutNodeContext"
    process(currentNode, workflowCodegenContext, containerParsingContext){

        Logger.info(`processing fake event without node context`);
        return null;

    }
}

export default FakeNodeProcessor;