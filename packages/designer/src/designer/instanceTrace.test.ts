import { describe, it, expect } from 'vitest';
import { computeHighlights, pendingTaskAt, type FlowEnds } from './instanceTrace';

// Start -> Flow_1 -> Approve (human task) -> Flow_2 -> Record -> Flow_3 -> End
const ENDS: Record<string, { source: string; target: string }> = {
  Flow_1: { source: 'Start', target: 'Approve' },
  Flow_2: { source: 'Approve', target: 'Record' },
  Flow_3: { source: 'Record', target: 'End' },
};
const flowEnds: FlowEnds = (id) => ENDS[id] ?? null;
const sorted = (set: Set<string>) => [...set].sort();

describe('computeHighlights', () => {
  it('marks the node an instance waits at as active, what led there as executed', () => {
    const highlights = computeHighlights({
      flows: [{ flowId: 'Flow_1', status: 'active' }],
      tasks: [{ nodeId: 'Approve', nodeName: 'Approve', type: 'HumanTask', status: 'active' }],
    }, flowEnds);
    expect(sorted(highlights.active)).toEqual(['Approve']);
    expect(sorted(highlights.executed)).toEqual(['Flow_1', 'Start']);
    expect(highlights.failed.size).toBe(0);
  });

  it('greys out the whole path of a completed instance, end event included', () => {
    const highlights = computeHighlights({
      flows: [{ flowId: 'Flow_1', status: 'completed' }, { flowId: 'Flow_2', status: 'completed' }, { flowId: 'Flow_3', status: 'completed' }],
      tasks: [{ nodeId: 'Approve', nodeName: 'Approve', type: 'HumanTask', status: 'completed' }],
    }, flowEnds);
    expect(highlights.active.size).toBe(0);
    expect(sorted(highlights.executed)).toEqual(['Approve', 'End', 'Flow_1', 'Flow_2', 'Flow_3', 'Record', 'Start']);
  });

  it('shows failures in red and not as executed', () => {
    const highlights = computeHighlights({
      flows: [{ flowId: 'Flow_1', status: 'completed' }, { flowId: 'Flow_2', status: 'error' }],
      tasks: [],
    }, flowEnds);
    expect(sorted(highlights.failed)).toEqual(['Flow_2', 'Record']);
    expect(highlights.executed.has('Record')).toBe(false);
    expect(highlights.executed.has('Approve')).toBe(true);
  });

  it('prefers waiting over passed when a loop comes back to a node', () => {
    const highlights = computeHighlights({
      flows: [{ flowId: 'Flow_1', status: 'completed' }],
      tasks: [{ nodeId: 'Approve', nodeName: null, type: 'HumanTask', status: 'active' }],
    }, flowEnds);
    expect(highlights.active.has('Approve')).toBe(true);
    expect(highlights.executed.has('Approve')).toBe(false);
  });

  it('ignores flows the diagram does not have', () => {
    const highlights = computeHighlights({ flows: [{ flowId: 'Gone', status: 'completed' }], tasks: [] }, flowEnds);
    expect(sorted(highlights.executed)).toEqual(['Gone']);
  });
});

describe('pendingTaskAt', () => {
  it('finds only active tasks', () => {
    const trace = { tasks: [
      { nodeId: 'A', nodeName: null, type: 'CatchEvent', status: 'completed' },
      { nodeId: 'B', nodeName: null, type: 'CatchEvent', status: 'active' },
    ] };
    expect(pendingTaskAt(trace, 'A')).toBeUndefined();
    expect(pendingTaskAt(trace, 'B')?.type).toBe('CatchEvent');
  });
});
