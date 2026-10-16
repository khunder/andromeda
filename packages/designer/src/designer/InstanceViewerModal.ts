/**
 * A process instance on its diagram, in a modal: a read-only bpmn-js viewer
 * of the BPMN the instance runs, with the nodes / flows it has passed in
 * grey, the nodes it waits at highlighted and failures in red - from Galaxy's
 * GET /galaxy/process-instances/:id/trace, refreshed every few seconds.
 *
 * Under the diagram: the selected node's state and the instance's variables.
 * Clicking a node it waits at opens a separate dialog over the viewer:
 * - human task: its form (iform), Accept resumes the process;
 * - catch event: variables as JSON (Monaco) + the process's file
 *   variables, Send resumes it.
 * Both go to the container's POST /{processDef}/signal, with the designer's
 * OIDC token. Containers are reached on Galaxy's host (like the Tasks view).
 */
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import andromedaModdleSource from '../../../engine/src/modules/engine/builder/andromeda.moddle.json?raw';
import { iform, IFormValidationError, type IForm } from '../iform';
import { ContainerClient, signalPayloadFromForm, taskFormDefinition, type SignalFiles } from './ContainerClient';
import { computeHighlights, pendingTaskAt, type Highlights, type InstanceTrace, type TraceTask } from './instanceTrace';
import { loadMonaco } from './MonacoLoader';
import { showToast } from './Toast';

declare const monaco: any;

const ANDROMEDA_MODDLE = JSON.parse(andromedaModdleSource);
const REFRESH_MS = 5000;
const MARKERS = { executed: 'iv-executed', active: 'iv-active', failed: 'iv-failed', selected: 'iv-selected' } as const;

export interface InstanceViewerOptions {
  galaxyUrl: string;
  processInstanceId: string;
  /** Authorization header for the container, read on every request */
  authHeaders: () => Record<string, string>;
}

type NodeState = 'executed' | 'active' | 'failed' | 'not reached';

export class InstanceViewerModal {
  private root: HTMLDivElement | null = null;
  private viewer: any = null;
  private options!: InstanceViewerOptions;
  private trace: InstanceTrace | null = null;
  private highlights: Highlights = { executed: new Set(), active: new Set(), failed: new Set() };
  private importedXml: string | null = null;
  private selectedId: string | null = null;
  /** node id + state the side panel shows - re-rendered only when it changes */
  private panelKey = '';
  private form: IForm | null = null;
  private editor: any = null;
  private timer: number | null = null;
  private busy = false;
  /** the form / event dialog of a waiting node, opened over the viewer */
  private taskModal: HTMLDivElement | null = null;
  private taskModalNodeId: string | null = null;
  private readonly onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    // the form dialog first, then the viewer
    if (this.taskModal) this.closeTaskModal();
    else this.close();
  };

  async open(options: InstanceViewerOptions): Promise<void> {
    this.close();
    this.options = { ...options, galaxyUrl: options.galaxyUrl.replace(/\/$/, '') };
    this.root = document.createElement('div');
    this.root.className = 'instance-viewer';
    this.root.innerHTML = `
      <div class="iv-overlay"></div>
      <div class="iv-dialog" role="dialog" aria-modal="true" aria-label="Process instance">
        <header class="iv-header">
          <div class="iv-heading">
            <h2 class="iv-title">Process instance</h2>
            <div class="iv-meta"></div>
          </div>
          <div class="iv-legend" aria-hidden="true">
            <span><i class="iv-swatch iv-swatch-executed"></i>executed</span>
            <span><i class="iv-swatch iv-swatch-active"></i>waiting</span>
            <span><i class="iv-swatch iv-swatch-failed"></i>failed</span>
          </div>
          <button class="iv-btn iv-refresh" title="Refresh">⟳</button>
          <button class="iv-close" title="Close" aria-label="Close">×</button>
        </header>
        <div class="iv-body">
          <div class="iv-canvas"><div class="iv-message" hidden></div></div>
          <section class="iv-bottom">
            <div class="iv-node"></div>
            <div class="iv-vars"></div>
          </section>
        </div>
      </div>
    `;
    this.root.querySelector('.iv-overlay')!.addEventListener('click', () => this.close());
    this.root.querySelector('.iv-close')!.addEventListener('click', () => this.close());
    this.root.querySelector('.iv-refresh')!.addEventListener('click', () => void this.refresh());
    document.addEventListener('keydown', this.onKey);
    document.body.appendChild(this.root);

    this.viewer = new NavigatedViewer({
      container: this.root.querySelector('.iv-canvas') as HTMLElement,
      moddleExtensions: { andromeda: ANDROMEDA_MODDLE },
    });
    // clicking a waiting node opens its form / event dialog straight away
    this.viewer.get('eventBus').on('element.click', (event: any) => this.select(event.element, true));

    await this.refresh();
    // open on what needs attention
    const firstActive = this.highlights.active.values().next().value;
    this.selectById(firstActive ?? null);
    this.timer = window.setInterval(() => {
      if (!document.hidden && !this.busy) void this.refresh();
    }, REFRESH_MS);
  }

  close(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('keydown', this.onKey);
    this.closeTaskModal();
    this.viewer?.destroy();
    this.viewer = null;
    this.root?.remove();
    this.root = null;
    this.trace = null;
    this.importedXml = null;
    this.selectedId = null;
    this.panelKey = '';
  }

  // ---- data -----------------------------------------------------------------

  private async refresh(): Promise<void> {
    if (!this.root) return;
    let trace: InstanceTrace;
    try {
      const response = await fetch(`${this.options.galaxyUrl}/galaxy/process-instances/${encodeURIComponent(this.options.processInstanceId)}/trace`);
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || `HTTP ${response.status}`);
      trace = body as InstanceTrace;
    } catch (error) {
      this.showMessage(`Cannot load the instance from Galaxy: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    if (!this.root) return; // closed meanwhile
    this.trace = trace;
    this.renderHeader();

    if (!trace.bpmn) {
      this.showMessage(`No diagram: ${trace.bpmnError ?? 'the BPMN is unavailable'}.`);
    } else if (trace.bpmn !== this.importedXml) {
      try {
        await this.viewer.importXML(trace.bpmn);
        this.importedXml = trace.bpmn;
        this.viewer.get('canvas').zoom('fit-viewport', 'auto');
        this.showMessage(null);
      } catch (error) {
        this.showMessage(`The diagram could not be drawn: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    this.applyHighlights();
    this.renderVariables();
    this.renderPanel(); // no-op unless the selected node's state changed
    // the node was completed meanwhile (elsewhere) - its form is stale
    if (this.taskModalNodeId && !pendingTaskAt(trace, this.taskModalNodeId)) {
      this.closeTaskModal();
      showToast('That step is no longer waiting - it was completed meanwhile.', 'info');
    }
  }

  private client(): ContainerClient | null {
    const port = this.trace?.container?.port;
    if (!port) return null;
    let host = '127.0.0.1';
    try {
      host = new URL(this.options.galaxyUrl).hostname;
    } catch {
      // keep the default
    }
    return new ContainerClient(host, port, this.options.authHeaders);
  }

  // ---- diagram --------------------------------------------------------------

  private applyHighlights(): void {
    if (!this.trace || !this.importedXml) return;
    const registry = this.viewer.get('elementRegistry');
    const canvas = this.viewer.get('canvas');
    this.highlights = computeHighlights(this.trace, (flowId) => {
      const flow = registry.get(flowId);
      return flow?.source && flow?.target ? { source: flow.source.id, target: flow.target.id } : null;
    });
    registry.getAll().forEach((element: any) => {
      for (const marker of [MARKERS.executed, MARKERS.active, MARKERS.failed]) canvas.removeMarker(element, marker);
    });
    const mark = (ids: Set<string>, marker: string) => ids.forEach((id) => {
      if (registry.get(id)) canvas.addMarker(id, marker);
    });
    mark(this.highlights.executed, MARKERS.executed);
    mark(this.highlights.active, MARKERS.active);
    mark(this.highlights.failed, MARKERS.failed);
  }

  private stateOf(id: string): NodeState {
    if (this.highlights.active.has(id)) return 'active';
    if (this.highlights.failed.has(id)) return 'failed';
    if (this.highlights.executed.has(id)) return 'executed';
    return 'not reached';
  }

  private selectById(id: string | null): void {
    const element = id ? this.viewer?.get('elementRegistry').get(id) : null;
    this.select(element ?? null);
  }

  private select(element: any, openTask = false): void {
    if (!this.viewer) return;
    const canvas = this.viewer.get('canvas');
    if (this.selectedId) canvas.removeMarker(this.selectedId, MARKERS.selected);
    const isNode = element && element.type !== 'label' && element.businessObject && element.id !== canvas.getRootElement().id;
    this.selectedId = isNode ? element.id : null;
    if (this.selectedId) canvas.addMarker(this.selectedId, MARKERS.selected);
    this.panelKey = '';
    this.renderPanel();
    if (openTask && this.selectedId && this.trace && pendingTaskAt(this.trace, this.selectedId) && this.client()) {
      this.openTaskModal(this.selectedId);
    }
  }

  // ---- under the diagram: selected node + variables ---------------------------

  private renderHeader(): void {
    const trace = this.trace!;
    this.root!.querySelector('.iv-title')!.textContent = trace.instance.processDef;
    const meta = this.root!.querySelector('.iv-meta') as HTMLElement;
    meta.replaceChildren();
    const status = document.createElement('span');
    status.className = `iv-status iv-status-${trace.instance.status}`;
    status.textContent = trace.instance.status;
    const id = document.createElement('code');
    id.textContent = trace.instance.id;
    meta.append(status, ' ', trace.instance.deploymentId, ' · ', id);
  }

  private renderVariables(): void {
    const section = this.root!.querySelector('.iv-vars') as HTMLElement;
    const heading = document.createElement('h3');
    heading.textContent = `Variables (${this.trace!.variables.length})`;
    if (this.trace!.variables.length === 0) {
      section.replaceChildren(heading, this.hint('No variables set yet.'));
      return;
    }
    const table = document.createElement('table');
    table.className = 'iv-var-table';
    table.innerHTML = '<thead><tr><th>Name</th><th>Type</th><th>Value</th><th>Updated</th></tr></thead>';
    const body = document.createElement('tbody');
    for (const variable of this.trace!.variables) {
      const row = document.createElement('tr');
      const value = typeof variable.value === 'string' ? variable.value : JSON.stringify(variable.value);
      for (const [text, className] of [
        [variable.name, 'iv-var-name'],
        [variable.type, 'iv-type'],
        [value, 'iv-var-value'],
        [variable.updatedAt ? new Date(variable.updatedAt).toLocaleTimeString() : '', 'iv-var-time'],
      ]) {
        const cell = document.createElement('td');
        cell.className = className;
        cell.textContent = text;
        if (className === 'iv-var-value') cell.title = text;
        row.append(cell);
      }
      body.append(row);
    }
    table.append(body);
    section.replaceChildren(heading, table);
  }

  private renderPanel(): void {
    if (!this.root || !this.trace) return;
    const id = this.selectedId;
    const pending = id ? pendingTaskAt(this.trace, id) : undefined;
    const state = id ? this.stateOf(id) : 'instance';
    const key = `${id}:${state}:${pending?.type ?? ''}`;
    if (key === this.panelKey) return; // unchanged
    this.panelKey = key;

    const section = this.root.querySelector('.iv-node') as HTMLElement;
    section.replaceChildren();
    if (!id) {
      section.append(this.hint(this.highlights.active.size > 0
        ? 'Click a highlighted node to complete it, or any node to see its state.'
        : 'Click a node to see its state.'));
      return;
    }
    const element = this.viewer.get('elementRegistry').get(id);
    const bo = element.businessObject;
    const title = document.createElement('h3');
    title.textContent = bo.name || id;
    const meta = document.createElement('div');
    meta.className = 'iv-node-meta';
    const badge = document.createElement('span');
    badge.className = `iv-state iv-state-${state.replace(' ', '-')}`;
    badge.textContent = state === 'active' ? 'waiting' : state;
    meta.append(`${bo.$type.replace('bpmn:', '')} · `, badge);
    section.append(title, meta);

    if (!pending) return;
    if (!this.client()) {
      section.append(this.hint(`No running container for ${this.trace.instance.deploymentId} - start it to complete this step.`));
      return;
    }
    const nodeId = id;
    section.append(this.actions([{
      label: pending.type === 'HumanTask' ? 'Open form' : 'Send event',
      primary: true,
      title: pending.type === 'HumanTask' ? 'Complete this human task' : 'Resume the instance waiting at this event',
      run: () => this.openTaskModal(nodeId),
    }]));
  }

  // ---- the form / event dialog, over the viewer -------------------------------

  private openTaskModal(nodeId: string): void {
    const pending = this.trace ? pendingTaskAt(this.trace, nodeId) : undefined;
    if (!pending || !this.viewer) return;
    this.closeTaskModal();
    const bo = this.viewer.get('elementRegistry').get(nodeId)?.businessObject;
    const modal = document.createElement('div');
    modal.className = 'iv-task-modal';
    modal.innerHTML = `
      <div class="iv-task-overlay"></div>
      <div class="iv-task-dialog" role="dialog" aria-modal="true">
        <header class="iv-task-header">
          <div>
            <h2></h2>
            <div class="iv-node-meta"></div>
          </div>
          <button class="iv-close" title="Close" aria-label="Close">×</button>
        </header>
        <div class="iv-task-body"></div>
      </div>
    `;
    const title = bo?.name || nodeId;
    modal.querySelector('h2')!.textContent = title;
    modal.querySelector('[role="dialog"]')!.setAttribute('aria-label', title);
    (modal.querySelector('.iv-node-meta') as HTMLElement).textContent =
      `${pending.type === 'HumanTask' ? 'Human task' : 'Catch event'} · ${this.trace!.instance.processDef} · ${this.trace!.instance.id}`;
    modal.querySelector('.iv-task-overlay')!.addEventListener('click', () => this.closeTaskModal());
    modal.querySelector('.iv-close')!.addEventListener('click', () => this.closeTaskModal());
    document.body.appendChild(modal);
    this.taskModal = modal;
    this.taskModalNodeId = nodeId;

    const host = modal.querySelector('.iv-task-body') as HTMLElement;
    if (pending.type === 'HumanTask') void this.renderHumanTask(host, pending);
    else this.renderCatchEvent(host, pending, bo);
  }

  private closeTaskModal(): void {
    this.form?.destroy();
    this.form = null;
    this.editor?.dispose();
    this.editor = null;
    this.taskModal?.remove();
    this.taskModal = null;
    this.taskModalNodeId = null;
  }

  private async renderHumanTask(host: HTMLElement, task: TraceTask): Promise<void> {
    const client = this.client()!;
    const { processDef, id: processInstanceId } = this.trace!.instance;
    let detail;
    try {
      detail = await client.taskDetail(processDef, processInstanceId, task.nodeId);
    } catch (error) {
      host.append(this.hint(error instanceof Error ? error.message : String(error), true));
      return;
    }
    if (!host.isConnected) return;
    const formHost = document.createElement('div');
    formHost.className = 'iv-form';
    const note = this.hint(`May change: ${detail.editableVariables.join(', ') || 'every variable'}${detail.roles.length ? ` · roles: ${detail.roles.join(', ')}` : ''}`);
    const actions = this.actions([
      { label: 'Close', title: 'Dismiss the form - nothing is sent', run: () => this.closeTaskModal() },
      { label: 'Accept', primary: true, title: 'Submit the form - the process continues', run: async () => {
        let data;
        try {
          data = await this.form!.submit();
        } catch (error) {
          showToast(error instanceof IFormValidationError ? 'Please fix the highlighted fields' : String(error), 'error');
          return;
        }
        const { formData, files } = signalPayloadFromForm(this.form!, data, detail.editableVariables);
        await this.resume(task, { formData, ...(Object.keys(files).length ? { files } : {}) });
      } },
    ]);
    host.append(note, formHost, actions);
    this.form = iform.create(formHost, taskFormDefinition(detail), { data: detail.variables });
  }

  private renderCatchEvent(host: HTMLElement, task: TraceTask, bo: any): void {
    const definition = (bo.eventDefinitions || [])[0];
    const kind = definition?.$type?.replace('bpmn:', '').replace('EventDefinition', '') || 'Catch';
    const name = definition?.signalRef?.name || definition?.messageRef?.name;
    host.append(this.hint(`${kind} event${name ? ` "${name}"` : ''} - send variables (JSON) and files to resume the instance.${kind === 'Timer' ? ' A timer also resumes it on its own when due.' : ''}`));

    const label = document.createElement('label');
    label.className = 'iv-label';
    label.textContent = 'Variables (JSON object)';
    const code = document.createElement('div');
    code.className = 'iv-json';
    const fallback = document.createElement('textarea');
    fallback.className = 'iv-json-fallback';
    fallback.spellcheck = false;
    fallback.value = '{\n  \n}';
    code.append(fallback);
    let getText = () => fallback.value;
    loadMonaco().then(() => {
      if (!code.isConnected) return;
      const text = fallback.value;
      fallback.remove();
      this.editor = monaco.editor.create(code, {
        value: text, language: 'json', theme: 'vs', automaticLayout: true,
        minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 12, tabSize: 2, lineNumbersMinChars: 3,
      });
      getText = () => this.editor.getValue();
    }).catch(() => { /* offline - the text area stays */ });

    // the process's file variables, uploaded with the signal
    const fileVariables: string[] = (this.processElement()?.properties || [])
      .filter((property: any) => property.itemSubjectRef?.structureRef === 'file' && property.name)
      .map((property: any) => property.name);
    const fileInputs = new Map<string, HTMLInputElement>();
    const files = document.createElement('div');
    files.className = 'iv-files';
    if (fileVariables.length) {
      const filesLabel = document.createElement('div');
      filesLabel.className = 'iv-label';
      filesLabel.textContent = 'Files';
      files.append(filesLabel);
      for (const variable of fileVariables) {
        const row = document.createElement('label');
        row.className = 'iv-file-row';
        const input = document.createElement('input');
        input.type = 'file';
        row.append(variable, input);
        files.append(row);
        fileInputs.set(variable, input);
      }
    }

    const actions = this.actions([
      { label: 'Close', title: 'Dismiss - nothing is sent', run: () => this.closeTaskModal() },
      { label: 'Send', primary: true, title: 'Resume the instance with these variables and files', run: async () => {
        let variables: Record<string, unknown>;
        try {
          const parsed = JSON.parse(getText().trim() || '{}');
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('expected a JSON object');
          variables = parsed;
        } catch (error) {
          showToast(`Variables: ${error instanceof Error ? error.message : String(error)}`, 'error');
          return;
        }
        const picked: SignalFiles = {};
        for (const [variable, input] of fileInputs) {
          const file = input.files?.[0];
          if (file) picked[variable] = { base64: await readAsDataUrl(file), fileName: file.name, contentType: file.type || 'application/octet-stream' };
        }
        await this.resume(task, { variables, ...(Object.keys(picked).length ? { files: picked } : {}) });
      } },
    ]);
    host.append(label, code, files, actions);
  }

  private async resume(task: TraceTask, body: { variables?: Record<string, unknown>; formData?: Record<string, unknown>; files?: SignalFiles }): Promise<void> {
    const client = this.client();
    if (!client || !this.trace) return;
    this.busy = true;
    try {
      const result = await client.signal(this.trace.instance.processDef, { processInstanceId: this.trace.instance.id, nodeId: task.nodeId, ...body });
      const label = task.nodeName || task.nodeId;
      showToast(result.warnings?.length ? `${label}: resumed - ${result.warnings.join('; ')}` : `${label}: resumed - the process continues`, result.warnings?.length ? 'warning' : 'success');
      this.closeTaskModal();
      // the container moves on asynchronously - look again shortly
      await new Promise((resolve) => window.setTimeout(resolve, 600));
      await this.refresh();
      window.setTimeout(() => void this.refresh(), 1500);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      this.busy = false;
    }
  }

  private processElement(): any {
    const definitions = this.viewer?.getDefinitions?.();
    return (definitions?.rootElements || []).find((element: any) => element.$type === 'bpmn:Process');
  }

  // ---- small builders -------------------------------------------------------

  private hint(text: string, error = false): HTMLElement {
    const element = document.createElement('p');
    element.className = error ? 'iv-hint iv-hint-error' : 'iv-hint';
    element.textContent = text;
    return element;
  }

  private actions(buttons: { label: string; title: string; primary?: boolean; run: () => void | Promise<void> }[]): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'iv-actions';
    for (const spec of buttons) {
      const button = document.createElement('button');
      button.className = spec.primary ? 'iv-btn iv-btn-primary' : 'iv-btn';
      button.textContent = spec.label;
      button.title = spec.title;
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await spec.run();
        } finally {
          button.disabled = false;
        }
      });
      bar.append(button);
    }
    return bar;
  }

  private showMessage(text: string | null): void {
    const message = this.root?.querySelector('.iv-message') as HTMLElement | null;
    if (!message) return;
    message.textContent = text ?? '';
    message.hidden = !text;
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
