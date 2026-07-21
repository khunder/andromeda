import {AndromedaLogger} from "../../../../config/andromeda-logger.js";
import {StructureKind} from "ts-morph";
import cron from "node-cron";

const Logger = new AndromedaLogger();

/**
 * Timer Start Event (<bpmn:startEvent> with a <bpmn:timerEventDefinition>
 * whose <bpmn:timeCycle> body is a raw cron expression, e.g. "0 9 * * *"):
 * the per-node method (fn_<id>) generated below is unchanged from a plain
 * start event - the same `this.fn_<id>().catch(...)` injected into
 * bootstrap() still runs it, however the instance was created (manually via
 * POST /start, or automatically by the timer). What's different is WHO calls
 * createInstance()+bootstrap() in the first place: for a timer start event,
 * that's timer.service.js, on a node-cron schedule read from TimerModel at
 * container boot - see that file for the HA claim (PersistenceGateway.
 * claimTimerTick) that keeps multiple container replicas of the same
 * deployment from each creating their own instance for the same tick.
 */
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

        const timerEventDefinition = currentNode.eventDefinitions
            ?.find((def) => def.$type === 'bpmn:TimerEventDefinition');
        if (timerEventDefinition) {
            const cronExpression = timerEventDefinition.timeCycle?.body?.trim();
            if (!cronExpression) {
                throw new Error(`Timer Start Event ${currentNode.id} needs a <bpmn:timeCycle> cron expression`);
            }
            if (!cron.validate(cronExpression)) {
                throw new Error(`Timer Start Event ${currentNode.id} has an invalid cron expression: "${cronExpression}"`);
            }
            Logger.debug(`registering timer start event ${currentNode.id} with cron "${cronExpression}"`);
            workflowCodegenContext.timerModelClass.addProperty({
                kind: StructureKind.Property,
                isStatic: true,
                initializer: JSON.stringify({id: currentNode.id, kind: 'start', cron: cronExpression}),
                name: currentNode.id,
            });
        }

        return nodeContext;

    }
}

export default StartNodeProcessor;