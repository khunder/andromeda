/**
 * The BPMN a container was built from, read only (Galaxy card → "BPMN"):
 * the diagram, and - for the clicked element - everything configured on it:
 * a script task's script (Monaco, read only), a user task's roles, editable
 * variables and form (rendered by iform, disabled), conditions, timers,
 * signals, messages, documentation. Nothing selected: the process's
 * variables and roles. The header says which version is deployed.
 *
 * Reads the container's GET /api/bpmn (deployed version) and
 * GET /api/bpmn/:processDef (the BPMN kept at compile time). A container
 * running several processes asks which one first.
 */
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import andromedaModdleSource from '../../../engine/src/modules/engine/builder/andromeda.moddle.json?raw';
import { iform, type IForm, type IFormDefinition } from '../iform';
import { loadMonaco } from './MonacoLoader';

declare const monaco: any;

const ANDROMEDA_MODDLE = JSON.parse(andromedaModdleSource);

export interface BpmnInspectorOptions {
  host: string;
  port: string | number;
  deploymentId: string;
  /** the container's processes (Galaxy) - asked for when several */
  processDefs: string[];
}

interface DeployedVersion {
  deploymentId?: string;
  version?: string | null;
  compiledAt?: string | null;
  processDefs?: string[];
}

export class BpmnInspectorModal {
  private root: HTMLDivElement | null = null;
  private viewer: any = null;
  private editors: any[] = [];
  private forms: IForm[] = [];
  private selectedId: string | null = null;
  private readonly onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.close();
  };

  async open(options: BpmnInspectorOptions): Promise<void> {
    this.close();
    const base = `http://${options.host}:${options.port}`;
    let deployed: DeployedVersion = {};
    try {
      const response = await fetch(`${base}/api/bpmn`);
      if (response.ok) deployed = await response.json();
    } catch {
      // unreachable - reported when the BPMN can't be fetched either
    }
    const processDefs = options.processDefs.length > 0 ? options.processDefs : deployed.processDefs ?? [];
    const processDef = processDefs.length > 1 ? await this.choose(options.deploymentId, processDefs) : processDefs[0];
    if (!processDef) return; // chooser cancelled (or nothing to show)

    this.render(options, processDef, deployed);
    let xml: string | null = null;
    let error = '';
    try {
      const response = await fetch(`${base}/api/bpmn/${encodeURIComponent(processDef)}`);
      if (response.ok) xml = await response.text();
      else error = response.status === 404
        ? 'This container keeps no BPMN - it was compiled before BPMN files were kept. Recompile and redeploy it.'
        : `The container answered HTTP ${response.status}.`;
    } catch {
      error = `Cannot reach the container at ${base}.`;
    }
    if (!this.root) return; // closed meanwhile
    if (!xml) {
      this.showMessage(error);
      return;
    }
    try {
      await this.viewer.importXML(xml);
      this.viewer.get('canvas').zoom('fit-viewport', 'auto');
    } catch (importError) {
      this.showMessage(`The BPMN could not be drawn: ${importError instanceof Error ? importError.message : String(importError)}`);
      return;
    }
    this.renderDetails(null);
  }

  close(): void {
    document.removeEventListener('keydown', this.onKey);
    this.disposeDetails();
    this.viewer?.destroy();
    this.viewer = null;
    this.root?.remove();
    this.root = null;
    this.selectedId = null;
  }

  // ---- process chooser ------------------------------------------------------

  /** Several processes in the container: which one to show (null = cancelled). */
  private choose(deploymentId: string, processDefs: string[]): Promise<string | null> {
    return new Promise((resolve) => {
      const chooser = document.createElement('div');
      chooser.className = 'bi-chooser';
      chooser.innerHTML = `
        <div class="bi-overlay"></div>
        <div class="bi-chooser-dialog" role="dialog" aria-modal="true" aria-label="Choose a process">
          <h2>Which process?</h2>
          <p class="bi-hint"></p>
          <div class="bi-chooser-list"></div>
          <div class="bi-actions"><button class="iv-btn" data-action="cancel">Cancel</button></div>
        </div>
      `;
      (chooser.querySelector('.bi-hint') as HTMLElement).textContent = `${deploymentId} runs ${processDefs.length} processes.`;
      const done = (value: string | null) => {
        document.removeEventListener('keydown', onKey);
        chooser.remove();
        resolve(value);
      };
      const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') done(null);
      };
      const list = chooser.querySelector('.bi-chooser-list')!;
      for (const processDef of processDefs) {
        const button = document.createElement('button');
        button.className = 'bi-choice';
        button.textContent = processDef;
        button.addEventListener('click', () => done(processDef));
        list.append(button);
      }
      chooser.querySelector('.bi-overlay')!.addEventListener('click', () => done(null));
      chooser.querySelector('[data-action="cancel"]')!.addEventListener('click', () => done(null));
      document.addEventListener('keydown', onKey);
      document.body.append(chooser);
      (list.querySelector('button') as HTMLButtonElement | null)?.focus();
    });
  }

  // ---- modal ----------------------------------------------------------------

  private render(options: BpmnInspectorOptions, processDef: string, deployed: DeployedVersion): void {
    this.root = document.createElement('div');
    this.root.className = 'instance-viewer bpmn-inspector';
    this.root.innerHTML = `
      <div class="iv-overlay"></div>
      <div class="iv-dialog" role="dialog" aria-modal="true">
        <header class="iv-header">
          <div class="iv-heading">
            <h2 class="iv-title"></h2>
            <div class="iv-meta"></div>
          </div>
          <span class="bi-readonly">read only</span>
          <button class="iv-close" title="Close" aria-label="Close">×</button>
        </header>
        <div class="bi-body">
          <div class="iv-canvas bi-canvas"><div class="iv-message" hidden></div></div>
          <aside class="bi-details"></aside>
        </div>
      </div>
    `;
    this.root.querySelector('.iv-title')!.textContent = processDef;
    this.root.querySelector('[role="dialog"]')!.setAttribute('aria-label', `BPMN of ${processDef}`);
    // which version is deployed
    const meta = this.root.querySelector('.iv-meta') as HTMLElement;
    const parts = [
      deployed.deploymentId || options.deploymentId,
      deployed.version ? `version ${deployed.version}` : '',
      deployed.compiledAt ? `compiled ${new Date(deployed.compiledAt).toLocaleString()}` : '',
      `port ${options.port}`,
    ].filter(Boolean);
    meta.textContent = parts.join(' · ');
    this.root.querySelector('.iv-overlay')!.addEventListener('click', () => this.close());
    this.root.querySelector('.iv-close')!.addEventListener('click', () => this.close());
    document.addEventListener('keydown', this.onKey);
    document.body.appendChild(this.root);

    this.viewer = new NavigatedViewer({
      container: this.root.querySelector('.bi-canvas') as HTMLElement,
      moddleExtensions: { andromeda: ANDROMEDA_MODDLE },
    });
    this.viewer.get('eventBus').on('element.click', (event: any) => this.select(event.element));
  }

  private select(element: any): void {
    const canvas = this.viewer.get('canvas');
    if (this.selectedId) canvas.removeMarker(this.selectedId, 'bi-selected');
    const isElement = element?.businessObject && element.type !== 'label' && element.id !== canvas.getRootElement().id;
    this.selectedId = isElement ? element.id : null;
    if (this.selectedId) canvas.addMarker(this.selectedId, 'bi-selected');
    this.renderDetails(isElement ? element : null);
  }

  // ---- details --------------------------------------------------------------

  private renderDetails(element: any): void {
    this.disposeDetails();
    const panel = this.root?.querySelector('.bi-details') as HTMLElement | null;
    if (!panel) return;
    panel.replaceChildren();
    if (!element) {
      this.renderProcess(panel);
      return;
    }
    const bo = element.businessObject;
    panel.append(this.heading(bo.name || bo.id, `${typeLabel(bo.$type)} · ${bo.id}`));
    const documentation = (bo.documentation || []).map((doc: any) => doc.text).filter(Boolean).join('\n');
    if (documentation) panel.append(this.section('Documentation', this.text(documentation)));

    switch (bo.$type) {
      case 'bpmn:ScriptTask':
        panel.append(this.section(`Script${bo.scriptFormat ? ` (${bo.scriptFormat})` : ''}`, this.code(bo.script || '', 'javascript', 'No script.')));
        break;
      case 'bpmn:UserTask':
        this.renderUserTask(panel, bo);
        break;
      case 'bpmn:SequenceFlow':
        panel.append(this.section('Condition', bo.conditionExpression?.body
          ? this.code(bo.conditionExpression.body, 'javascript', '')
          : this.text(isDefaultFlow(bo) ? 'Default flow (taken when no other condition holds).' : 'Unconditional.')));
        panel.append(this.section('From → to', this.text(`${bo.sourceRef?.name || bo.sourceRef?.id} → ${bo.targetRef?.name || bo.targetRef?.id}`)));
        break;
      default:
        break;
    }
    if (/Gateway$/.test(bo.$type)) this.renderGateway(panel, bo);
    for (const definition of bo.eventDefinitions || []) this.renderEventDefinition(panel, definition);
  }

  private renderProcess(panel: HTMLElement): void {
    const definitions = this.viewer?.getDefinitions?.();
    const process = (definitions?.rootElements || []).find((element: any) => element.$type === 'bpmn:Process');
    panel.append(this.heading(process?.name || process?.id || 'Process', 'Click an element to see its configuration.'));

    // <bpmn:property> typed by its itemDefinition's structureRef (how the designer declares variables)
    const variables: string[][] = (process?.properties || [])
      .filter((property: any) => property.name)
      .map((property: any) => [property.name, property.itemSubjectRef?.structureRef || 'string']);
    panel.append(this.section(`Variables (${variables.length})`, variables.length
      ? this.table(['Name', 'Type'], variables)
      : this.text('No process variables declared.')));

    const roles = (definitions?.rootElements || []).filter((element: any) => element.$type === 'bpmn:Resource');
    panel.append(this.section(`Roles (${roles.length})`, roles.length
      ? this.chips(roles.map((role: any) => role.name || role.id))
      : this.text('No roles declared - human tasks are open to any authenticated user.')));
  }

  private renderUserTask(panel: HTMLElement, bo: any): void {
    const roles = (bo.resources || [])
      .filter((owner: any) => owner.$type === 'bpmn:PotentialOwner' && owner.resourceRef)
      .map((owner: any) => owner.resourceRef.name || owner.resourceRef.id);
    panel.append(this.section('Who may complete it', this.chips(['process-admin (always)', ...roles])));

    const extensions = bo.extensionElements?.values || [];
    const editable = extensions.filter((value: any) => value.$type === 'andromeda:EditableVariable').map((value: any) => value.name);
    panel.append(this.section('Variables it may change', editable.length ? this.chips(editable) : this.text('Every process variable (no form decides it).')));

    const formBody = extensions.find((value: any) => value.$type === 'andromeda:Form')?.body;
    if (!formBody) {
      panel.append(this.section('Form', this.text('No form - the worklist shows the variables it may change as fields.')));
      return;
    }
    let form: IFormDefinition | null = null;
    try {
      form = JSON.parse(formBody);
    } catch {
      // shown as JSON below
    }
    const host = document.createElement('div');
    host.className = 'bi-form';
    panel.append(this.section('Form', host));
    if (form && Array.isArray(form.components)) {
      this.forms.push(iform.create(host, form, { readOnly: true }));
    }
    panel.append(this.section('Form JSON', this.code(JSON.stringify(form ?? formBody, null, 2), 'json', '', 220)));
  }

  private renderGateway(panel: HTMLElement, bo: any): void {
    const outgoing = bo.outgoing || [];
    if (outgoing.length === 0) return;
    panel.append(this.section('Outgoing flows', this.table(['Flow', 'To', 'Condition'], outgoing.map((flow: any) => [
      flow.name || flow.id,
      flow.targetRef?.name || flow.targetRef?.id || '',
      flow.conditionExpression?.body || (bo.default === flow ? 'default' : '-'),
    ]))));
  }

  private renderEventDefinition(panel: HTMLElement, definition: any): void {
    switch (definition.$type) {
      case 'bpmn:TimerEventDefinition': {
        const rows: string[][] = [];
        if (definition.timeCycle?.body) rows.push(['Cycle (cron)', definition.timeCycle.body]);
        if (definition.timeDuration?.body) rows.push(['Duration', definition.timeDuration.body]);
        if (definition.timeDate?.body) rows.push(['Date', definition.timeDate.body]);
        panel.append(this.section('Timer', rows.length ? this.table(['', ''], rows) : this.text('Not configured.')));
        break;
      }
      case 'bpmn:SignalEventDefinition':
        panel.append(this.section('Signal', this.text(definition.signalRef?.name || 'Any signal (no name).')));
        break;
      case 'bpmn:MessageEventDefinition':
        panel.append(this.section('Message', this.text(definition.messageRef?.name || 'Any message (no name).')));
        break;
      default:
        panel.append(this.section('Event', this.text(typeLabel(definition.$type))));
    }
  }

  private disposeDetails(): void {
    this.editors.forEach((editor) => editor.dispose());
    this.editors = [];
    this.forms.forEach((form) => form.destroy());
    this.forms = [];
  }

  // ---- small builders -------------------------------------------------------

  private heading(title: string, subtitle: string): HTMLElement {
    const box = document.createElement('div');
    box.className = 'bi-heading';
    const h3 = document.createElement('h3');
    h3.textContent = title;
    const meta = document.createElement('div');
    meta.className = 'iv-node-meta';
    meta.textContent = subtitle;
    box.append(h3, meta);
    return box;
  }

  private section(label: string, content: HTMLElement): HTMLElement {
    const section = document.createElement('section');
    section.className = 'bi-section';
    const title = document.createElement('div');
    title.className = 'iv-label';
    title.textContent = label;
    section.append(title, content);
    return section;
  }

  private text(value: string): HTMLElement {
    const p = document.createElement('p');
    p.className = 'iv-hint bi-text';
    p.textContent = value;
    return p;
  }

  private chips(values: string[]): HTMLElement {
    const box = document.createElement('div');
    box.className = 'bi-chips';
    for (const value of values) {
      const chip = document.createElement('code');
      chip.textContent = value;
      box.append(chip);
    }
    return box;
  }

  private table(headers: string[], rows: string[][]): HTMLElement {
    const table = document.createElement('table');
    table.className = 'iv-var-table';
    if (headers.some(Boolean)) {
      const head = table.createTHead().insertRow();
      for (const header of headers) head.append(Object.assign(document.createElement('th'), { textContent: header }));
    }
    const body = table.createTBody();
    for (const row of rows) {
      const tr = body.insertRow();
      for (const cell of row) tr.insertCell().textContent = cell;
    }
    return table;
  }

  /** Read-only Monaco (a <pre> until it's loaded, or if it can't be). */
  private code(source: string, language: string, empty: string, height = 0): HTMLElement {
    if (!source) return this.text(empty);
    const host = document.createElement('div');
    host.className = 'bi-code';
    const lines = source.split('\n').length;
    host.style.height = `${height || Math.min(360, Math.max(60, lines * 18 + 16))}px`;
    const pre = document.createElement('pre');
    pre.textContent = source;
    host.append(pre);
    loadMonaco().then(() => {
      if (!host.isConnected) return;
      pre.remove();
      this.editors.push(monaco.editor.create(host, {
        value: source, language, readOnly: true, domReadOnly: true, theme: 'vs', automaticLayout: true,
        minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 12, lineNumbersMinChars: 3, wordWrap: 'on',
      }));
    }).catch(() => { /* offline - the <pre> stays */ });
    return host;
  }

  private showMessage(text: string): void {
    const message = this.root?.querySelector('.iv-message') as HTMLElement | null;
    if (!message) return;
    message.textContent = text;
    message.hidden = false;
  }
}

function typeLabel(type: string): string {
  return String(type).replace(/^bpmn:/, '').replace(/EventDefinition$/, ' event').replace(/([a-z])([A-Z])/g, '$1 $2');
}

function isDefaultFlow(flow: any): boolean {
  return flow.sourceRef?.default === flow;
}
