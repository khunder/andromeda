/**
 * A process instance's progress, as Galaxy reports it (GET
 * /galaxy/process-instances/:id/trace), and what to highlight on its diagram.
 *
 * The engine records the sequence flows an instance takes (FlowEvent: active
 * while the instance waits at the flow's target - a human task or catch
 * event) and the tasks it reaches; nodes are derived from the flows' ends.
 */

export interface TraceFlow {
  flowId: string;
  status: 'active' | 'completed' | 'error' | 'aborted' | string;
}

export interface TraceTask {
  nodeId: string;
  nodeName: string | null;
  type: 'HumanTask' | 'CatchEvent' | string;
  status: 'active' | 'completed' | string;
}

export interface TraceVariable {
  name: string;
  type: string;
  value: unknown;
  updatedAt: string | null;
}

export interface InstanceTrace {
  instance: { id: string; deploymentId: string; processDef: string; status: string; lockedBy: string | null };
  /** the container serving the deployment - where pending tasks are completed */
  container: { port: string } | null;
  bpmn: string | null;
  bpmnError: string | null;
  flows: TraceFlow[];
  tasks: TraceTask[];
  variables: TraceVariable[];
}

export interface Highlights {
  /** nodes / flows already passed */
  executed: Set<string>;
  /** nodes the instance waits at */
  active: Set<string>;
  /** nodes / flows where it failed */
  failed: Set<string>;
}

export type FlowEnds = (flowId: string) => { source: string; target: string } | null;

export function computeHighlights(trace: Pick<InstanceTrace, 'flows' | 'tasks'>, flowEnds: FlowEnds): Highlights {
  const executed = new Set<string>();
  const active = new Set<string>();
  const failed = new Set<string>();

  for (const flow of trace.flows) {
    const ends = flowEnds(flow.flowId);
    if (ends) executed.add(ends.source);
    if (flow.status === 'error') {
      failed.add(flow.flowId);
      if (ends) failed.add(ends.target);
      continue;
    }
    executed.add(flow.flowId);
    if (!ends) continue;
    if (flow.status === 'active') active.add(ends.target);
    else if (flow.status === 'completed') executed.add(ends.target);
  }
  for (const task of trace.tasks) {
    if (task.status === 'active') active.add(task.nodeId);
    else executed.add(task.nodeId);
  }
  // waiting wins over passed (a loop back to a task already done once)
  active.forEach((id) => executed.delete(id));
  failed.forEach((id) => executed.delete(id));
  return { executed, active, failed };
}

/** The pending task (human task / catch event) at a node, if the instance waits there. */
export function pendingTaskAt(trace: Pick<InstanceTrace, 'tasks'>, nodeId: string): TraceTask | undefined {
  return trace.tasks.find((task) => task.nodeId === nodeId && task.status === 'active');
}
