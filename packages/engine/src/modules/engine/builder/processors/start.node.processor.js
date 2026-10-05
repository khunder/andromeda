import {AndromedaLogger} from "../../../../config/andromeda-logger.js";
import {StructureKind} from "ts-morph";
import {CronExpressionParser} from "cron-parser";

const Logger = new AndromedaLogger();

// Structural check only - mirrors durable-timers.js's own parseIso() cycle
// branch (`R` or `R<n>`, then 1-2 more `/`-separated segments, the last one
// a ISO 8601 duration) without importing across the engine/generated-
// container boundary: that file lives under builder/templates, meant to run
// inside generated containers, not this codegen step (same reasoning
// catch-event.processor.js's own ISO8601_DURATION_PATTERN comment gives for
// duplicating rather than importing). The container's own TimerService does
// the real parsing (and is what actually runs the schedule) at boot.
const ISO8601_DURATION_PATTERN = /^P(?:\d+(?:\.\d+)?Y)?(?:\d+(?:\.\d+)?M)?(?:\d+(?:\.\d+)?W)?(?:\d+(?:\.\d+)?D)?(?:T(?:\d+(?:\.\d+)?H)?(?:\d+(?:\.\d+)?M)?(?:\d+(?:\.\d+)?S)?)?$/;

function isValidIsoTimeCycle(expression) {
    const parts = expression.split('/');
    if (parts.length < 2 || parts.length > 3 || !/^R\d*$/.test(parts[0])) {
        return false;
    }
    const duration = parts[parts.length - 1];
    return ISO8601_DURATION_PATTERN.test(duration) && duration !== 'P' && !duration.endsWith('T');
}

function isValidCron(expression) {
    try {
        CronExpressionParser.parse(expression);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Timer Start Event (<bpmn:startEvent> with a <bpmn:timerEventDefinition>):
 * the per-node method (fn_<id>) generated below is unchanged from a plain
 * start event - the same `this.fn_<id>().catch(...)` injected into
 * bootstrap() still runs it, however the instance was created (manually via
 * POST /start, or automatically by the timer). What's different is WHO calls
 * createInstance()+bootstrap() in the first place: for a timer start event,
 * that's the container's TimerService (durable-timers.js), scheduled from
 * TimerModel at container boot - see timer.service.js.njk for the HA lease
 * claim that keeps multiple container replicas of the same deployment from
 * each creating their own instance for the same occurrence.
 *
 * <bpmn:timeCycle>'s body can be either:
 * - an ISO 8601 repeating interval (e.g. "R/PT10S", "R3/PT1H") - scheduled
 *   natively by durable-timers.js, which already tracks its own next
 *   occurrence without drift;
 * - a raw cron expression (e.g. "0 9 * * *", for calendar schedules an ISO
 *   8601 interval can't express) - the container computes each next
 *   occurrence with cron-parser and re-schedules itself one fire at a time
 *   (see the 'cron-start' handler in timer.service.js.njk).
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
            const timeCycle = timerEventDefinition.timeCycle?.body?.trim();
            if (!timeCycle) {
                throw new Error(`Timer Start Event ${currentNode.id} needs a <bpmn:timeCycle> (ISO 8601 interval, e.g. "R/PT10S", or a cron expression)`);
            }

            let timerModelEntry;
            if (isValidIsoTimeCycle(timeCycle)) {
                Logger.debug(`registering timer start event ${currentNode.id} with ISO 8601 cycle "${timeCycle}"`);
                timerModelEntry = {id: currentNode.id, kind: 'start', iso: timeCycle};
            } else if (isValidCron(timeCycle)) {
                Logger.debug(`registering timer start event ${currentNode.id} with cron "${timeCycle}"`);
                timerModelEntry = {id: currentNode.id, kind: 'start', cron: timeCycle};
            } else {
                throw new Error(`Timer Start Event ${currentNode.id} has an invalid <bpmn:timeCycle>: "${timeCycle}" (not a valid ISO 8601 interval or cron expression)`);
            }

            workflowCodegenContext.timerModelClass.addProperty({
                kind: StructureKind.Property,
                isStatic: true,
                initializer: JSON.stringify(timerModelEntry),
                name: currentNode.id,
            });
        }

        return nodeContext;

    }
}

export default StartNodeProcessor;
