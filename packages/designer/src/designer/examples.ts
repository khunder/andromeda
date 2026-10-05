/// <reference types="vite/client" />

/**
 * Example diagrams for the toolbar "Examples" dropdown: every BPMN scenario
 * used by the engine's test suite (packages/engine/test/**), bundled as raw
 * XML at build time so new test fixtures show up here automatically.
 */

export interface BpmnExample {
  /** human readable label, derived from the file name */
  label: string;
  /** path relative to packages/engine/test, e.g. resources/human-task.bpmn */
  path: string;
  xml: string;
}

const files = import.meta.glob('../../../engine/test/**/*.bpmn', {
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
