import {AndromedaLogger} from "../../../../config/andromeda-logger.js";

const Logger = new AndromedaLogger();

/**
 * Intermediate catch event: a two-phase ("pause and wait") node, inspired by
 * beeflow's CatchEventProcessor design (its `executeBody`/`alternateBody`
 * NodeContext shape) — though beeflow's own resume path was never actually
 * finished there, so the wiring here (the /signal route in controller.njk,
 * ContainerService's live-instance registry, and closing the pending
 * FlowEvent) is new, not ported.
 *
 * How it works:
 * - On normal flow arrival, `flowModel` is the raw incoming flow id string
 *   (see build.method.next.calls.njk's callFunction args), so
 *   `flowModel.executeBody` is always undefined/falsy — build.method.njk
 *   routes into `alternateBody` instead of `body`, which just logs that the
 *   instance is now waiting, and next.calls.njk never runs. The instance
 *   stays "paused" here: the incoming flow's FlowEvent was already recorded
 *   Active (status 0) by the caller's createFlowEvent(), once
 *   isTwoPhaseComponent() recognizes "IntermediateCatchEvent" (service.njk).
 * - To resume, an external POST /signal call (controller.njk) looks the
 *   process instance up in ContainerService's in-memory registry, confirms
 *   there's still an Active FlowEvent for this node's incoming flow
 *   (PersistenceGateway.findActiveFlowEvent), closes it, and calls
 *   `fn_<nodeId>({executeBody: true, id: <flowId>})` directly (not through
 *   callFunction — its `...Object.values(args)` spread only forwards a
 *   single positional value, which can't carry an { executeBody, id } shape).
 *   That re-enters this same generated method with executeBody now true, so
 *   it runs `body` and falls through to the outgoing flows.
 *
 * Known limitation: resume only works while the process instance is still
 * live in this container process's memory (ContainerService.processInstances)
 * — there's no rehydration of a paused instance's variables from persistence
 * after a container restart. Fine for the embedded/sandbox use case this
 * targets today; a real "resume after restart" would need a variables-load
 * path that doesn't exist yet anywhere in the engine.
 */
class CatchEventNodeProcessor {
    static type = "bpmn:IntermediateCatchEvent"

    /**
     *
     * @param currentNode
     * @param workflowCodegenContext : WorkflowCodegenContext
     * @param containerParsingContext : ContainerParsingContext
     * @returns {NodeContext}
     */
    process(currentNode, workflowCodegenContext, containerParsingContext){

        Logger.debug(`processing intermediate catch event`);

        // bpmn:SignalEventDefinition/signalRef -> the root-level <bpmn:signal
        // id="..." name="..."/> element. Not required: a catch event with no
        // event definition is still a valid (if generic) "wait for an
        // external /signal call naming this node" pause point.
        const signalName = currentNode.eventDefinitions
            ?.find((def) => def.$type === 'bpmn:SignalEventDefinition')
            ?.signalRef?.name;

        /**
         * @type {NodeContext}
         */
        const nodeContext = {
            id: currentNode.id,
            type: currentNode.$type,
            name: currentNode.name || currentNode.id,
            // non-null (not the boolean value itself) is what tells
            // build.method.njk to generate the executeBody/alternateBody
            // if/else at all; the actual runtime decision reads
            // flowModel.executeBody, set at the two call sites described
            // above, not this codegen-time value.
            args: {executeBody: false},
            body: `Logger.info(\`process instance \${this.processInstanceId} resumed at catch event ${currentNode.id}\`);`,
            alternateBody: `Logger.info(\`process instance \${this.processInstanceId} is now waiting at catch event ${currentNode.id}${signalName ? ` for signal "${signalName}"` : ''}\`);`,
        };

        return nodeContext;

    }
}

export default CatchEventNodeProcessor;
