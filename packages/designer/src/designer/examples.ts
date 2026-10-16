/// <reference types="vite/client" />

/**
 * Example diagrams for the toolbar "Examples" dropdown: a curated subset of the
 * BPMN scenarios used by the engine's test suite (packages/engine/test/**),
 * bundled as raw XML at build time.
 */

export interface BpmnExample {
  /** human readable label, derived from the file name */
  label: string;
  /** path relative to packages/engine/test, e.g. resources/human-task.bpmn */
  path: string;
  xml: string;
}

// import.meta.glob only accepts literals, so the list is spelled out here
const files = import.meta.glob([
  '../../../engine/test/resources/timer-start-event.bpmn',
  '../../../engine/test/resources/timer-intermediate-catch-event.bpmn',
  '../../../engine/test/resources/timer-intermediate-catch-event-restore.bpmn',
  '../../../engine/test/resources/parallel-gateway-join.bpmn',
  '../../../engine/test/resources/intermediate-catch-event-signal.bpmn',
  '../../../engine/test/resources/exclusive-gateway-conditional-flow.bpmn',
  '../../../engine/test/resources/double-variable-assignment.bpmn',
  '../../../engine/test/resources/document-intake.bpmn',
  '../../../engine/test/resources/expense-approval.bpmn',
], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function toLabel(fileName: string): string {
  return fileName
    .replace(/\.bpmn$/, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const BPMN_EXAMPLES: BpmnExample[] = Object.entries(files)
  .map(([key, xml]) => {
    const path = key.replace(/^.*\/engine\/test\//, '');
    const fileName = path.split('/').pop() || path;
    return { label: toLabel(fileName), path, xml };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

/** diagram the designer opens with */
export const DEFAULT_EXAMPLE = BPMN_EXAMPLES.find(
  e => e.path === 'resources/timer-intermediate-catch-event.bpmn'
);
