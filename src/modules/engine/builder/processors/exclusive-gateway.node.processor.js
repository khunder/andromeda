import {AndromedaLogger} from "../../../../config/andromeda-logger.js";

const Logger = new AndromedaLogger();

/**
 * Exclusive gateway. Registered so the node compiles instead of throwing
 * "cannot find suitable processor" — it does not yet implement true exclusive
 * (pick-one-branch) semantics.
 *
 * build.method.next.calls.njk already computes each outgoing flow's
 * `executable` from its condition expression, but nothing currently gates the
 * call to the next node on that flag ("support conditional flow" is a
 * separate, not-yet-implemented roadmap item) — so today an exclusive gateway
 * behaves the same as a parallel one: every outgoing flow fires.
 */
class ExclusiveGatewayNodeProcessor {
    static type = "bpmn:ExclusiveGateway"
    process(currentNode, workflowCodegenContext, containerParsingContext){
        Logger.info(`processing exclusive gateway`);
        return {
            id: currentNode.id,
            type: currentNode.$type,
            name: currentNode.name || currentNode.id,
            body: ``,
        };
    }
}

export default ExclusiveGatewayNodeProcessor;
