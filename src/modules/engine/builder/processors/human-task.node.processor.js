import {AndromedaLogger} from "../../../../config/andromeda-logger.js";

const Logger = new AndromedaLogger();

/**
 * Human task (<bpmn:userTask>): a two-phase ("pause and wait") node, exactly
 * like catch-event.processor.js's IntermediateCatchEvent — a process
 * instance arriving here stops and waits for an external actor, rather than
 * running straight through. The only real difference from a catch event is
 * what it's waiting FOR: a signal by name there, a human completing the task
 * (optionally submitting variables, e.g. form output) here. Both resume
 * through the exact same generic POST /signal mechanism (controller.njk) —
 * it was already node-type-agnostic (looks up the node purely by id via
 * WorkflowModel), so no new route was needed, just this processor plus
 * GET /tasks below to let a caller discover what's actually waiting.
 *
 * See catch-event.processor.js's doc comment for the full pause/resume
 * mechanics (flowModel.executeBody, isTwoPhaseComponent, restoreInstance
 * after a container restart) — identical here.
 */
class HumanTaskNodeProcessor {
    static type = "bpmn:UserTask"

    /**
     *
     * @param currentNode
     * @param workflowCodegenContext : WorkflowCodegenContext
     * @param containerParsingContext : ContainerParsingContext
     * @returns {NodeContext}
     */
    process(currentNode, workflowCodegenContext, containerParsingContext){

        Logger.debug(`processing human task`);

        /**
         * @type {NodeContext}
         */
        const nodeContext = {
            id: currentNode.id,
            type: currentNode.$type,
            name: currentNode.name || currentNode.id,
            // non-null (not the boolean value itself) is what tells
            // build.method.njk to generate the executeBody/alternateBody
            // if/else at all; see catch-event.processor.js for the two real
            // call sites that set flowModel.executeBody at runtime.
            args: {executeBody: false},
            body: `Logger.info(\`process instance \${this.processInstanceId} resumed after human task ${currentNode.id}\`);`,
            alternateBody: `Logger.info(\`process instance \${this.processInstanceId} is now waiting on human task ${currentNode.id}${currentNode.name ? ` ("${currentNode.name}")` : ''}\`);`,
        };

        return nodeContext;

    }
}

export default HumanTaskNodeProcessor;
