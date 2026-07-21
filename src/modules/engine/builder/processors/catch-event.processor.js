import {AndromedaLogger} from "../../../../config/andromeda-logger.js";
import {StructureKind} from "ts-morph";

const Logger = new AndromedaLogger();

// mirrors iso8601-duration.js's own pattern (which does the real parsing, at
// container runtime, since a timeDuration is relative to the node's arrival
// time, not something resolvable at compile time here) - duplicated rather
// than imported because that file lives under builder/templates, meant for
// generated containers, not the engine process this codegen step runs in.
// This copy only needs to catch obviously malformed values early.
const ISO8601_DURATION_PATTERN = /^P(?:\d+(?:\.\d+)?Y)?(?:\d+(?:\.\d+)?M)?(?:\d+(?:\.\d+)?W)?(?:\d+(?:\.\d+)?D)?(?:T(?:\d+(?:\.\d+)?H)?(?:\d+(?:\.\d+)?M)?(?:\d+(?:\.\d+)?S)?)?$/;

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

        // <bpmn:timerEventDefinition> with a <bpmn:timeDuration> (relative to
        // this node's arrival, e.g. "PT5M") or <bpmn:timeDate> (an absolute
        // one-off instant) - either way this is still the exact same
        // two-phase pause as a signal catch event (same FlowEvent Active/
        // status-0 gate below), it just resumes itself automatically instead
        // of waiting on an external POST /signal call. A TimerCatchResumeJob
        // is enqueued (via TimerService.enqueueCatchResume(), see below) for
        // exactly the computed due time - Sidequest (a DB-backed job queue,
        // see timer.service.js) schedules and dispatches it, rather than a
        // fixed-interval sweep polling for due Tasks.
        const timerEventDefinition = currentNode.eventDefinitions
            ?.find((def) => def.$type === 'bpmn:TimerEventDefinition');

        const nodeName = currentNode.name || currentNode.id;
        // stored in Task.correlation - not queried against yet, but carries
        // whatever a future broadcast-style signal delivery would match on
        const correlation = signalName ? {signalName} : {};

        let timerDueAtStatement = '';
        let timerLogSuffix = '';
        if (timerEventDefinition) {
            const timeDateBody = timerEventDefinition.timeDate?.body?.trim();
            const timeDurationBody = timerEventDefinition.timeDuration?.body?.trim();

            if (timeDateBody) {
                if (isNaN(Date.parse(timeDateBody))) {
                    throw new Error(`Timer Intermediate Catch Event ${currentNode.id} has an invalid <bpmn:timeDate>: "${timeDateBody}"`);
                }
                // wrapped through new Date().toISOString() to normalize
                // whatever valid date/time format the diagram author used
                timerDueAtStatement = `const __timerDueAt = new Date(${JSON.stringify(timeDateBody)}).toISOString();\n    `;
            } else if (timeDurationBody) {
                if (!ISO8601_DURATION_PATTERN.test(timeDurationBody) || timeDurationBody === 'P') {
                    throw new Error(`Timer Intermediate Catch Event ${currentNode.id} has an invalid <bpmn:timeDuration>: "${timeDurationBody}"`);
                }
                timerDueAtStatement = `const __timerDueAt = new Date(Date.now() + Iso8601Duration.toMilliseconds(${JSON.stringify(timeDurationBody)})).toISOString();\n    `;
            } else {
                throw new Error(`Timer Intermediate Catch Event ${currentNode.id} needs a <bpmn:timeDate> or <bpmn:timeDuration>`);
            }

            timerLogSuffix = ' until ${__timerDueAt}';

            Logger.debug(`registering timer intermediate catch event ${currentNode.id}`);
            workflowCodegenContext.timerModelClass.addProperty({
                kind: StructureKind.Property,
                isStatic: true,
                initializer: JSON.stringify({id: currentNode.id, kind: 'catch'}),
                name: currentNode.id,
            });
        }

        // when a timer is present, correlation needs the runtime-computed
        // __timerDueAt spliced in - JSON.stringify(correlation) alone can
        // only produce a value known at compile time
        const correlationExpr = timerEventDefinition
            ? `{ ...${JSON.stringify(correlation)}, dueAt: __timerDueAt }`
            : JSON.stringify(correlation);

        // schedules the actual auto-resume: enqueued once, right when the
        // instance arrives here, for exactly __timerDueAt - not discovered
        // later by a periodic sweep. The Task record above stays as the
        // external-facing/observable record; this is what actually wakes
        // the instance back up.
        const enqueueResumeStatement = timerEventDefinition
            ? `\n    await TimerService.enqueueCatchResume(${JSON.stringify(currentNode.id)}, this.processInstanceId, new Date(__timerDueAt));`
            : '';

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
            alternateBody: `${timerDueAtStatement}await PersistenceGateway.createTask({
        deploymentId: Config.getInstance().deploymentId,
        processDef: this.processDef,
        processInstanceId: this.processInstanceId,
        nodeId: ${JSON.stringify(currentNode.id)},
        nodeName: ${JSON.stringify(nodeName)},
        type: 'CatchEvent',
        correlation: ${correlationExpr},
    });${enqueueResumeStatement}
    Logger.info(\`process instance \${this.processInstanceId} is now waiting at catch event ${currentNode.id}${signalName ? ` for signal "${signalName}"` : ''}${timerLogSuffix}\`);`,
        };

        return nodeContext;

    }
}

export default CatchEventNodeProcessor;
