/**
 * Process variables declared in a BPMN document: <bpmn:property> of the
 * process, typed by the <bpmn:itemDefinition structureRef> it points to
 * (how the designer declares them - see BPMNDesigner's variables panel).
 */
export interface DeclaredVariable {
  name: string;
  type: string;
}

export function declaredVariables(bpmnXml: string): DeclaredVariable[] {
  const doc = new DOMParser().parseFromString(bpmnXml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return [];
  const types = new Map<string, string>();
  for (const item of Array.from(doc.getElementsByTagNameNS('*', 'itemDefinition'))) {
    const id = item.getAttribute('id');
    if (id) types.set(id, item.getAttribute('structureRef') || 'string');
  }
  return Array.from(doc.getElementsByTagNameNS('*', 'property'))
    // process variables only - not an activity's own properties
    .filter((property) => property.parentElement?.localName === 'process' && property.getAttribute('name'))
    .map((property) => ({
      name: property.getAttribute('name')!,
      type: types.get(property.getAttribute('itemSubjectRef') || '') || 'string',
    }));
}

/** The names of a process's `file` variables. */
export function fileVariables(bpmnXml: string): string[] {
  return declaredVariables(bpmnXml).filter((variable) => variable.type === 'file').map((variable) => variable.name);
}
