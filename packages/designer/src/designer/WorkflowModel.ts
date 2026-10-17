/**
 * The workflow being designed: one deployment (container id + version) made of
 * one or more processes, each a BPMN file of its own. The Andromeda panel shows
 * it as a tree, every process gets a tab over the editor, and Deploy compiles
 * all of them into one container (the engine accepts several BPMN files per
 * compile - each becomes a processDef named after its <bpmn:definitions id>,
 * and they must all share the same <bpmn:definitions version>).
 *
 * Remembered per browser so a reload finds the processes again.
 */

export interface WorkflowProcess {
  /** stable key - survives renaming the process definition */
  id: string;
  /** <bpmn:definitions id="..."> - the engine's processDef */
  processDef: string;
  xml: string;
}

interface StoredWorkflow {
  deploymentId: string;
  version: string;
  processes: WorkflowProcess[];
  activeId: string | null;
}

export const DEFAULT_DEPLOYMENT_ID = 'workflow';
export const DEFAULT_VERSION = '1.0.0';
const STORAGE_KEY = 'andromeda.designer.workflow';

const DEFINITIONS_TAG = /<((?:[\w.-]+:)?definitions)\b([^>]*?)(\/?)>/;

/** `<bpmn:definitions id="...">` of a BPMN document, null when there is none. */
export function readDefinitionsId(xml: string): string | null {
  const match = DEFINITIONS_TAG.exec(xml);
  return match ? /(?:^|\s)id="([^"]*)"/.exec(match[2])?.[1] ?? null : null;
}

/** `<bpmn:definitions version="...">` of a BPMN document, null when there is none. */
export function readDefinitionsVersion(xml: string): string | null {
  const match = DEFINITIONS_TAG.exec(xml);
  return match ? /(?:^|\s)version="([^"]*)"/.exec(match[2])?.[1] ?? null : null;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** The same document with its definitions id and/or version set (added when missing). */
export function withDefinitionsAttrs(xml: string, attrs: { id?: string; version?: string }): string {
  return xml.replace(DEFINITIONS_TAG, (_match, tag: string, rest: string, selfClose: string) => {
    let updated = rest;
    for (const [name, value] of Object.entries(attrs)) {
      if (value === undefined) continue;
      const pattern = new RegExp(`(^|\\s)${name}="[^"]*"`);
      updated = pattern.test(updated)
        ? updated.replace(pattern, `$1${name}="${escapeAttribute(value)}"`)
        : `${updated} ${name}="${escapeAttribute(value)}"`;
    }
    return `<${tag}${updated}${selfClose}>`;
  });
}

/** A blank process: a start event, nothing else. */
export function blankProcessXml(processDef: string, version: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="${escapeAttribute(processDef)}" version="${escapeAttribute(version)}" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;
}

function newId(): string {
  return `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Fires `change` after every mutation (already saved by then). */
export class WorkflowModel extends EventTarget {
  deploymentId = DEFAULT_DEPLOYMENT_ID;
  version = DEFAULT_VERSION;
  processes: WorkflowProcess[] = [];
  activeId: string | null = null;

  /**
   * The remembered workflow, or a fresh one with a single process made from
   * `initialXml` (the default example) when nothing was remembered yet.
   */
  static load(defaults: { deploymentId?: string; version?: string; initialXml: string }): WorkflowModel {
    const model = new WorkflowModel();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<StoredWorkflow>;
        if (Array.isArray(parsed.processes) && parsed.processes.length > 0) {
          model.deploymentId = parsed.deploymentId || DEFAULT_DEPLOYMENT_ID;
          model.version = parsed.version || DEFAULT_VERSION;
          model.processes = parsed.processes
            .filter((p) => p && typeof p.xml === 'string')
            .map((p) => ({ id: p.id || newId(), processDef: p.processDef || readDefinitionsId(p.xml) || 'process', xml: p.xml }));
          const active = model.processes.find((p) => p.id === parsed.activeId) ?? model.processes[0];
          model.activeId = active.id;
          return model;
        }
      }
    } catch (error) {
      console.warn('Ignoring remembered workflow:', error);
    }
    model.deploymentId = defaults.deploymentId || DEFAULT_DEPLOYMENT_ID;
    model.version = defaults.version || DEFAULT_VERSION;
    const processDef = readDefinitionsId(defaults.initialXml) || 'process';
    const process: WorkflowProcess = {
      id: newId(),
      processDef,
      xml: withDefinitionsAttrs(defaults.initialXml, { version: model.version }),
    };
    model.processes = [process];
    model.activeId = process.id;
    model.save();
    return model;
  }

  get(id: string | null | undefined): WorkflowProcess | undefined {
    return id ? this.processes.find((p) => p.id === id) : undefined;
  }

  getActive(): WorkflowProcess | undefined {
    return this.get(this.activeId);
  }

  hasProcessDef(processDef: string, exceptId?: string): boolean {
    return this.processes.some((p) => p.id !== exceptId && p.processDef === processDef);
  }

  setDeploymentId(deploymentId: string): void {
    const value = deploymentId.trim() || DEFAULT_DEPLOYMENT_ID;
    if (value === this.deploymentId) return;
    this.deploymentId = value;
    this.emit();
  }

  /** Every process carries the workflow's version in its own definitions. */
  setVersion(version: string): void {
    const value = version.trim() || DEFAULT_VERSION;
    if (value === this.version) return;
    this.version = value;
    this.processes = this.processes.map((p) => ({ ...p, xml: withDefinitionsAttrs(p.xml, { version: value }) }));
    this.emit();
  }

  /** Adds a process (its XML gets the given id and the workflow's version) and makes it active. */
  addProcess(input: { processDef: string; xml: string }): WorkflowProcess {
    const process: WorkflowProcess = {
      id: newId(),
      processDef: input.processDef,
      xml: withDefinitionsAttrs(input.xml, { id: input.processDef, version: this.version }),
    };
    this.processes = [...this.processes, process];
    this.activeId = process.id;
    this.emit();
    return process;
  }

  /** Updates a process; nothing happens (no `change`) when nothing differs. */
  updateProcess(id: string, patch: Partial<Pick<WorkflowProcess, 'processDef' | 'xml'>>): void {
    const process = this.get(id);
    if (!process) return;
    const next = { ...process, ...patch };
    if (next.processDef === process.processDef && next.xml === process.xml) return;
    this.processes = this.processes.map((p) => (p.id === id ? next : p));
    this.emit();
  }

  removeProcess(id: string): void {
    if (!this.get(id)) return;
    this.processes = this.processes.filter((p) => p.id !== id);
    if (this.activeId === id) {
      this.activeId = this.processes[0]?.id ?? null;
    }
    this.emit();
  }

  setActive(id: string): void {
    if (this.activeId === id || !this.get(id)) return;
    this.activeId = id;
    this.emit();
  }

  private emit(): void {
    this.save();
    this.dispatchEvent(new Event('change'));
  }

  private save(): void {
    const stored: StoredWorkflow = {
      deploymentId: this.deploymentId,
      version: this.version,
      processes: this.processes,
      activeId: this.activeId,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // storage unavailable (private mode, quota) - the workflow just isn't remembered
    }
  }
}
