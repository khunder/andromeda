import {Job} from "./job.js";
import {AndromedaLogger} from "../../config/andromeda-logger.js";
import {PersistenceGateway} from "../persistence/persistence-gateway.js";
import {ContainerService} from "../container/container.service.js";
import {ServiceRegistry} from "../container/registry.js";

const Logger = new AndromedaLogger();

/**
 * Resumes a process instance waiting at a timer intermediate catch event
 * whose due time has arrived - the automatic-firing equivalent of POST
 * /signal. Enqueued once, with `availableAt` set to the node's computed
 * `__timerDueAt` (see catch-event.processor.js's alternateBody codegen),
 * by TimerService.enqueueCatchResume() at the moment the process instance
 * actually arrives at the node - not polled for on a fixed interval.
 *
 * Generic across every workflow compiled into this container - the caller
 * (TimerService) passes along which processDef the node belongs to, and this
 * job resolves that workflow's service/model from the generated
 * ServiceRegistry (src/modules/container/registry.js) rather than importing
 * one hardcoded workflow.
 *
 * TimerJobRepository.claimDue()'s atomic conditional claim already
 * guarantees this job's `run()` is picked up and executed by exactly one
 * container replica, but `closeFlowEventIfActive`'s atomic conditional close
 * is kept as the real, ultimate gate anyway: it's the same claim `/signal`
 * itself relies on, and it's what makes it safe for a manual /signal call
 * and this job to race for the same node without either one needing to know
 * about the other.
 */
export class TimerCatchResumeJob extends Job {

    async run(processInstanceId, nodeId, processDef) {
        const registryEntry = ServiceRegistry[processDef];
        if (!registryEntry) {
            Logger.error(`timer catch resume job: unknown processDef ${processDef}`);
            return this.complete({resumed: false, reason: 'unknown-process-def'});
        }
        const {service, workflowModel} = registryEntry;

        const pendingFlow = Object.values(workflowModel).find(
            (flow) => flow.target && flow.target.id === nodeId
        );
        if (!pendingFlow) {
            Logger.error(`timer catch resume job: node ${nodeId} is not a known node in workflow ${processDef}`);
            return this.complete({resumed: false, reason: 'unknown-node'});
        }

        const closedFlowEvent = await PersistenceGateway.closeFlowEventIfActive({processInstanceId, flowId: pendingFlow.id});
        if (!closedFlowEvent) {
            // already resumed - by a manual /signal call, most likely
            return this.complete({resumed: false, reason: 'already-resumed'});
        }
        await PersistenceGateway.closeTask({processInstanceId, nodeId}).catch((error) => { Logger.error(error); });

        let processInstance = ContainerService.getInstance().processInstances[processInstanceId];
        if (!processInstance) {
            processInstance = await service.restoreInstance(processInstanceId);
        }
        if (!processInstance) {
            Logger.error(`timer catch resume job: process instance ${processInstanceId} was not found or is no longer active`);
            return this.complete({resumed: false, reason: 'instance-not-found'});
        }

        Logger.info(`timer catch event ${nodeId} (${processDef}) due, resuming process instance ${processInstanceId}`);
        processInstance[`fn_${nodeId}`]({executeBody: true, id: pendingFlow.id})
            .catch((error) => { Logger.error(error); });

        return this.complete({resumed: true});
    }
}

export default TimerCatchResumeJob;
