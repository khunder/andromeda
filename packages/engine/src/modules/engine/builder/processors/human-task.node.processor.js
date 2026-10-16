import {AndromedaLogger} from "../../../../config/andromeda-logger.js";

const Logger = new AndromedaLogger();

/**
 * Human task (<bpmn:userTask>): a two-phase ("pause and wait") node, exactly
 * like catch-event.processor.js's IntermediateCatchEvent — a process
 * instance arriving here stops and waits for an external actor, rather than
 * running straight through. The only real difference from a catch event is
 * what it's waiting FOR: a signal by name there, a human completing the task
 * (optionally submitting variables, e.g. form output) here. Both are gated
 * on the same FlowEvent Active/status-0 mechanism (isTwoPhaseComponent() in
 * service.njk) and resume through the exact same generic POST /signal
 * handler (controller.njk) — it was already node-type-agnostic (looks up
 * the node purely by id via WorkflowModel), so no new route was needed, just
 * this processor plus GET /tasks to let a caller discover what's actually
 * waiting. `alternateBody` also records a Task (PersistenceGateway.createTask,
 * type HumanTask) alongside the FlowEvent — a parallel, read-side record for
 * external consumers (Galaxy, other APIs), not itself what gates resume.
 *
 * See catch-event.processor.js's doc comment for the full pause/resume
 * mechanics (flowModel.executeBody, restoreInstance after a container
 * restart) — identical here.
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

        const nodeName = currentNode.name || currentNode.id;

        // who may complete it, what it may change, and its form - read at
        // runtime from the generated HumanTaskModel (see controller.njk)
        workflowCodegenContext.humanTaskModelClass?.addProperty({
            isStatic: true,
            name: JSON.stringify(currentNode.id),
            initializer: JSON.stringify(HumanTaskNodeProcessor.taskConfig(currentNode, nodeName)),
        });

        /**
         * @type {NodeContext}
         */
        const nodeContext = {
            id: currentNode.id,
            type: currentNode.$type,
            name: nodeName,
            // non-null (not the boolean value itself) is what tells
            // build.method.njk to generate the executeBody/alternateBody
            // if/else at all; see catch-event.processor.js for the two real
            // call sites that set flowModel.executeBody at runtime.
            args: {executeBody: false},
            body: `Logger.info(\`process instance \${this.processInstanceId} resumed after human task ${currentNode.id}\`);`,
            alternateBody: `await PersistenceGateway.createTask({
        deploymentId: Config.getInstance().deploymentId,
        processDef: this.processDef,
        processInstanceId: this.processInstanceId,
        nodeId: ${JSON.stringify(currentNode.id)},
        nodeName: ${JSON.stringify(nodeName)},
        type: 'HumanTask',
        correlation: {},
    });
    Logger.info(\`process instance \${this.processInstanceId} is now waiting on human task ${currentNode.id}${currentNode.name ? ` ("${currentNode.name}")` : ''}\`);`,
        };

        return nodeContext;

    }

    /**
     * A userTask's runtime configuration:
     * - roles: names of the bpmn:Resource elements its bpmn:potentialOwner /
     *   bpmn:performer refer to (process-admin may always complete it; no
     *   roles = any authenticated user)
     * - editableVariables: <andromeda:editableVariable name="..."/> - the
     *   process variables completing the task may change
     * - form: <andromeda:form> body, an iform form definition (JSON, shaped like form.io's)
     * @returns {{id: string, name: string, roles: string[], editableVariables: string[], form: object|null}}
     */
    static taskConfig(currentNode, nodeName) {
        const roles = (currentNode.resources || [])
            .filter((resource) => resource.$type === 'bpmn:PotentialOwner' || resource.$type === 'bpmn:Performer')
            .map((resource) => resource.resourceRef?.name || resource.resourceRef?.id)
            .filter(Boolean);

        const extensions = currentNode.extensionElements?.values || [];
        const editableVariables = extensions
            .filter((element) => element.$type === 'andromeda:EditableVariable' && element.name)
            .map((element) => element.name);

        let form = null;
        const formElement = extensions.find((element) => element.$type === 'andromeda:Form');
        if (formElement?.body && formElement.body.trim()) {
            try {
                form = JSON.parse(formElement.body);
            } catch (error) {
                throw new Error(`human task ${currentNode.id}: <andromeda:form> is not valid JSON (${error.message})`);
            }
        }

        return {
            id: currentNode.id,
            name: nodeName,
            roles: [...new Set(roles)],
            editableVariables: [...new Set(editableVariables)],
            form,
        };
    }
}

export default HumanTaskNodeProcessor;
