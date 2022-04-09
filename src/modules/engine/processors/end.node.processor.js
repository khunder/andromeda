const AndromedaLogger = require("../../../config/andromeda-logger");
const Logger = new AndromedaLogger();

class EndNodeProcessor {
    static type = "bpmn:EndEvent"
    process(currentNode, workflowCodegenContext, containerParsingContext){
        Logger.info(`processing start event`);
        return {
            id: currentNode.id,
            type: currentNode.$type,
            name: currentNode.name || currentNode.id,
            body: ``,
        };
    }
}

module.exports = EndNodeProcessor;