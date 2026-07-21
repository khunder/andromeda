import {AndromedaLogger} from "../../../../config/andromeda-logger.js";

const Logger = new AndromedaLogger();

/**
 * Diverging: fires every outgoing sequence flow, which is already the default
 * behavior of build.method.next.calls.njk for any node with multiple outgoing
 * flows.
 *
 * Converging (join): each incoming flow calls this node's fn_<id> method with
 * its own flow id as `flowModel` (see build.method.next.calls.njk's
 * `{incomingFlowId: '<flow.id>'}` -> callFunction's `...Object.values(args)`
 * spread, which passes that id as the method's first positional argument).
 * A per-gateway Map<flowId, 0|1> tracks which incoming flows have arrived;
 * the generated body marks the current one and only lets execution continue
 * past the guard once every tracked flow is at 1 (service.njk's shared
 * canPassParallelGateway()). The map is reset right after passing so a later
 * pass through the same gateway (e.g. a loop) needs fresh arrivals again.
 */
class ParallelGatewayNodeProcessor {
    static type = "bpmn:ParallelGateway"
    process(currentNode, workflowCodegenContext, containerParsingContext){
        Logger.info(`processing parallel gateway`);

        const incomingFlowIds = (currentNode.incoming || []).map((flow) => flow.id);
        const mapFieldName = `${currentNode.id}Map`;

        workflowCodegenContext.serviceClass.addMember(
            `${mapFieldName} = new Map(${JSON.stringify(incomingFlowIds.map((id) => [id, 0]))});`
        );

        const body = incomingFlowIds.length > 0 ? `
        this.${mapFieldName}.set(flowModel, 1);
        if (!this.canPassParallelGateway(this.${mapFieldName})) {
            Logger.trace(\`parallel gateway ${currentNode.id} waiting for other incoming flows: \${JSON.stringify(Array.from(this.${mapFieldName}.entries()))}\`);
            return;
        }
        this.${mapFieldName}.forEach((_value, key) => this.${mapFieldName}.set(key, 0));
        ` : ``;

        return {
            id: currentNode.id,
            type: currentNode.$type,
            name: currentNode.name || currentNode.id,
            body,
        };
    }
}

export default ParallelGatewayNodeProcessor;
