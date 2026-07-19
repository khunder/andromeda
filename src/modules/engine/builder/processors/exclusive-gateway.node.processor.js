import {AndromedaLogger} from "../../../../config/andromeda-logger.js";

const Logger = new AndromedaLogger();

/**
 * Exclusive (XOR) gateway. Deliberately a thin pass-through, mirroring
 * ExclusiveGatewayProcessor: this processor doesn't touch conditions
 * itself. build.method.next.calls.njk evaluates each outgoing flow's own
 * <bpmn:conditionExpression> independently and only calls that flow's target
 * when it's truthy , the same generic mechanism gates conditional flow off
 * ANY node type, not just this one. An outgoing flow with no condition is
 * always taken (so a gateway with unconditioned branches still behaves like
 * a parallel fork).
 *
 * Note this means branch selection is NOT first-match/mutually-exclusive:
 * if two outgoing flows' conditions are both true, both fire (same as
 * andromeda , it relies on the diagram's conditions actually being exclusive,
 * it doesn't enforce it). There is also no `default` sequence flow support;
 * neither andromeda nor this processor reads the gateway's `default` attribute.
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
