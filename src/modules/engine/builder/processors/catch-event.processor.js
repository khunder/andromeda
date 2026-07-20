import {AndromedaLogger} from "../../../../config/andromeda-logger.js";

const Logger = new AndromedaLogger();

/**
 * Intermediate catch event: a two-phase ("pause and wait") node, inspired by
 * beeflow's CatchEventProcessor design (its `executeBody`/`alternateBody`
 * NodeContext shape) — though beeflow's own resume path was never actually
 * finished there, so the wiring here (the /signal route in controller.njk,
 * ContainerService's live-instance registry, the Task record) is new, not
 * ported.
 *
 * How it works:
 * - On normal flow arrival, `flowModel` is the raw incoming flow id string
 *   (see build.method.next.calls.njk's callFunction args), so
 *   `flowModel.executeBody` is always undefined/falsy — build.method.njk
 *   routes into `alternateBody` instead of `body`, and next.calls.njk never
 *   runs. Two things get recorded: the incoming flow's own FlowEvent is
 *   created Active/status 0 (isTwoPhaseComponent() in service.njk recognizes
 *   "IntermediateCatchEvent") — that's the container's own authoritative
 *   "is this instance still paused here" gate, checked/closed by POST
 *   /signal. `alternateBody` also records a Task (PersistenceGateway.createTask,
 *   type CatchEvent) alongside it — a parallel, read-side record for
 *   external consumers (Galaxy, other APIs) that want to list/inspect
 *   pending tasks without reaching into FlowEvent directly; it does not
 *   itself gate resume behavior.
 * - To resume, an external POST /signal call (controller.njk) looks the
 *   process instance up in ContainerService's in-memory registry, confirms
 *   there's still an Active FlowEvent for this node's incoming flow
 *   (PersistenceGateway.findActiveFlowEvent), closes it (plus the Task, for
 *   the external record), and calls `fn_<nodeId>({executeBody: true, id:
 *   <flowId>})` directly (not through callFunction — its
 *   `...Object.values(args)` spread only forwards a single positional value,
 *   which can't carry an { executeBody, id } shape). That re-enters this
 *   same generated method with executeBody now true, so it runs `body` and
 *   falls through to the outgoing flows.
 *
 * If the instance isn't in that in-memory registry (e.g. the container
 * restarted since it paused), controller.njk's /signal handler falls back to
 * {ProcessDef}ProcessInstanceService.restoreInstance(), which reconstructs it
 * from persistence and rehydrates its variables before resuming.
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

        const nodeName = currentNode.name || currentNode.id;
        // stored in Task.correlation - not queried against yet, but carries
        // whatever a future broadcast-style signal delivery would match on
        const correlation = signalName ? {signalName} : {};

        /**
         * @type {NodeContext}
         */
        const nodeContext = {
            id: currentNode.id,
            type: currentNode.$type,
            name: nodeName,
            // non-null (not the boolean value itself) is what tells
            // build.method.njk to generate the executeBody/alternateBody
            // if/else at all; the actual runtime decision reads
            // flowModel.executeBody, set at the two call sites described
            // above, not this codegen-time value.
            args: {executeBody: false},
            body: `Logger.info(\`process instance \${this.processInstanceId} resumed at catch event ${currentNode.id}\`);`,
            alternateBody: `await PersistenceGateway.createTask({
        deploymentId: Config.getInstance().deploymentId,
        processDef: this.processDef,
        processInstanceId: this.processInstanceId,
        nodeId: ${JSON.stringify(currentNode.id)},
        nodeName: ${JSON.stringify(nodeName)},
        type: 'CatchEvent',
        correlation: ${JSON.stringify(correlation)},
    });
    Logger.info(\`process instance \${this.processInstanceId} is now waiting at catch event ${currentNode.id}${signalName ? ` for signal "${signalName}"` : ''}\`);`,
        };

        return nodeContext;

    }
}

export default CatchEventNodeProcessor;
