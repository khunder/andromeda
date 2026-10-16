/**
 * Process Start Modal
 * Lets the user edit a JSON variables payload (via Monaco), attach files to
 * the process's `file` variables (upload, URL, container path or base64), and
 * start a process instance on the running container with them.
 */

import { DeploymentService, type StartFile } from './DeploymentService';
import { loadMonaco } from './MonacoLoader';
import { fileVariables } from './processVariables';
import { showToast } from './Toast';

type FileSource = 'upload' | 'url' | 'path' | 'base64';

const SOURCE_LABELS: Record<FileSource, string> = {
  upload: 'Upload',
  url: 'URL',
  path: 'Container path',
  base64: 'Base64',
};

declare const monaco: any;

// empty - the process's own defaults apply unless a value is given here
const DEFAULT_VARIABLES = `{

}`;

const formatSize = (bytes: number) =>
  bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`;

export class ProcessStartModal {
  private modal: HTMLDivElement | null = null;
  private editor: any = null;
  /** Called with the new instance's id once one is created - the dialog then closes. */
  onStarted: ((processInstanceId: string) => void) | null = null;

  constructor(private deploymentService: DeploymentService) {}

  async show(host: string, port: string | number, deploymentId: string, processDefs: string[] = []): Promise<void> {
    this.createModal(host, port, deploymentId, processDefs);
    const picker = this.modal?.querySelector('#start-params-process-def') as HTMLSelectElement | null;
    const selectedProcessDef = () => picker?.value ?? (processDefs.length === 1 ? processDefs[0] : '');
    // other process, other file variables - the rows start over
    picker?.addEventListener('change', () => void this.loadFileVariables(host, port, selectedProcessDef()));
    void this.loadFileVariables(host, port, selectedProcessDef());
    await loadMonaco();
    this.createEditor();
  }

  /**
   * One row per `file` variable of the process, ready to fill (an empty row
   * is simply not sent). A process without file variables: no Files section.
   * When they can't be read (container compiled before GET /api/bpmn): one
   * row with a typed variable name.
   */
  private async loadFileVariables(host: string, port: string | number, processDef: string): Promise<void> {
    const modal = this.modal;
    const section = modal?.querySelector('.start-files') as HTMLElement | null;
    const rows = modal?.querySelector('#start-files-rows') as HTMLElement | null;
    const hint = modal?.querySelector('.start-files-hint') as HTMLElement | null;
    if (!modal || !section || !rows || !hint) return;
    rows.replaceChildren();
    hint.textContent = 'Loading the process\'s file variables…';
    let variables: string[] | null = null;
    if (processDef) {
      try {
        const response = await fetch(`http://${host}:${port}/api/bpmn/${encodeURIComponent(processDef)}`);
        if (response.ok) variables = fileVariables(await response.text());
      } catch {
        // unreachable / older container - typed names below
      }
    }
    if (this.modal !== modal) return; // closed or reopened meanwhile
    section.hidden = !!variables && variables.length === 0;
    if (variables) {
      variables.forEach((name) => this.addFileRow(name));
    } else {
      this.addFileRow(null);
    }
    hint.textContent = 'Give a file for the variables you want set - empty ones are left out. Small files are kept in the database, bigger ones in object storage.';
  }

  hide(): void {
    this.editor?.dispose();
    this.editor = null;
    this.modal?.remove();
    this.modal = null;
  }

  private createModal(host: string, port: string | number, deploymentId: string, processDefs: string[]): void {
    if (this.modal) {
      this.modal.remove();
    }

    // A container generated before per-workflow route namespacing existed
    // reports no processDefs at all - fall back to the legacy bare /start
    // (DeploymentService.startProcessInstance handles '' that way). One
    // processDef: just use it, no need to ask. More than one: let the user pick.
    const processDefPicker = processDefs.length > 1
      ? `
        <label class="start-params-label" for="start-params-process-def">Process</label>
        <select id="start-params-process-def" class="start-params-select">
          ${processDefs.map((def) => `<option value="${this.escapeHtml(def)}">${this.escapeHtml(def)}</option>`).join('')}
        </select>
      `
      : '';

    this.modal = document.createElement('div');
    this.modal.className = 'start-params-modal';
    this.modal.innerHTML = `
      <div class="start-params-overlay"></div>
      <div class="start-params-content">
        <div class="start-params-header">
          <h2>Start Process Instance</h2>
          <button class="start-params-close" title="Close">×</button>
        </div>
        <div class="start-params-body">
          <p class="start-params-hint">Variables (JSON) for <strong>${this.escapeHtml(deploymentId)}</strong> , this object <em>is</em> your variables, e.g. <code>{"amount": 120}</code>. Do not wrap it in a <code>variables</code> key, that's added automatically.</p>
          ${processDefPicker}
          <div id="start-params-editor" class="start-params-editor"></div>

          <div class="start-files">
            <span class="start-params-label">Files</span>
            <p class="start-params-hint start-files-hint"></p>
            <div id="start-files-rows" class="start-files-rows"></div>
            <label class="start-files-force">
              <input type="checkbox" id="start-files-force">
              <span>Accept files above the size limit <em>- not recommended, the container stores them anyway and logs a warning</em></span>
            </label>
          </div>
        </div>
        <div class="start-params-footer">
          <div id="start-params-result" class="start-params-result"></div>
          <div class="footer-actions">
            <button class="btn-secondary" id="btn-cancel-start">Cancel</button>
            <button class="btn-primary" id="btn-confirm-start">▶ Start</button>
          </div>
        </div>
      </div>
    `;

    this.addStyles();
    document.body.appendChild(this.modal);

    const singleProcessDef = processDefs.length === 1 ? processDefs[0] : '';

    this.modal.querySelector('.start-params-close')?.addEventListener('click', () => this.hide());
    this.modal.querySelector('.start-params-overlay')?.addEventListener('click', () => this.hide());
    this.modal.querySelector('#btn-cancel-start')?.addEventListener('click', () => this.hide());
    this.modal.querySelector('#btn-confirm-start')?.addEventListener('click', () => void this.confirmStart(host, port, deploymentId, singleProcessDef));
  }

  /**
   * One file variable, as a card: its name and a clear button, the source
   * (upload / URL / container path / base64) as a segmented control, and
   * the source's input underneath. `name` null: the variable is typed.
   */
  private addFileRow(name: string | null): void {
    const rows = this.modal?.querySelector('#start-files-rows');
    if (!rows) return;

    const row = document.createElement('div');
    row.className = 'start-file-row';
    const top = document.createElement('div');
    top.className = 'start-file-top';

    const variable = document.createElement('input');
    variable.className = 'start-file-variable';
    if (name) {
      variable.type = 'hidden';
      variable.value = name;
      const label = document.createElement('span');
      label.className = 'start-file-name';
      label.textContent = name;
      top.append(label);
    } else {
      variable.placeholder = 'file variable name';
      variable.setAttribute('aria-label', 'File variable');
    }

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'start-file-remove';
    clear.title = 'Clear - this variable is then left out';
    clear.setAttribute('aria-label', `Clear the file for ${name ?? 'this variable'}`);
    clear.textContent = '×';
    top.append(variable, clear);

    // the source: a segmented control; its value is kept in a hidden field
    const source = document.createElement('input');
    source.type = 'hidden';
    source.className = 'start-file-source';
    source.value = 'upload';
    const segments = document.createElement('div');
    segments.className = 'start-file-sources';
    segments.setAttribute('role', 'radiogroup');
    segments.setAttribute('aria-label', 'File source');

    const valueSlot = document.createElement('div');
    valueSlot.className = 'start-file-value';

    const renderValueInput = (focus = false) => {
      const kind = source.value as FileSource;
      segments.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
        const selected = button.dataset.source === kind;
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-checked', String(selected));
      });
      if (kind === 'upload') {
        valueSlot.replaceChildren(this.uploadZone());
        return;
      }
      let input: HTMLInputElement | HTMLTextAreaElement;
      if (kind === 'base64') {
        input = document.createElement('textarea');
        input.rows = 3;
        input.placeholder = 'base64, or a data:<type>;base64,... URL';
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.placeholder = kind === 'url' ? 'https://example.org/invoice.pdf' : 'path inside FILE_INPUT_DIR, e.g. inbox/invoice.pdf';
      }
      input.className = 'start-file-input';
      valueSlot.replaceChildren(input);
      if (focus) input.focus();
    };
    (Object.keys(SOURCE_LABELS) as FileSource[]).forEach((key) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.source = key;
      button.setAttribute('role', 'radio');
      button.textContent = SOURCE_LABELS[key];
      button.addEventListener('click', () => {
        source.value = key;
        renderValueInput(true);
      });
      segments.append(button);
    });
    renderValueInput();
    // back to an empty upload
    clear.addEventListener('click', () => {
      source.value = 'upload';
      renderValueInput();
    });

    row.append(top, segments, source, valueSlot);
    rows.appendChild(row);
  }

  /** "Choose or drop a file" - a hidden file input behind a styled zone that shows the pick. */
  private uploadZone(): HTMLElement {
    const zone = document.createElement('label');
    zone.className = 'start-file-drop';
    const input = document.createElement('input');
    input.type = 'file';
    input.className = 'start-file-input';
    const text = document.createElement('span');
    text.className = 'start-file-drop-text';
    const show = () => {
      const file = input.files?.[0];
      zone.classList.toggle('has-file', !!file);
      text.textContent = file
        ? `${file.name} · ${formatSize(file.size)}`
        : 'Choose a file or drop it here';
    };
    input.addEventListener('change', show);
    zone.addEventListener('dragover', (event) => {
      event.preventDefault();
      zone.classList.add('dragging');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      zone.classList.remove('dragging');
      if (event.dataTransfer?.files.length) {
        input.files = event.dataTransfer.files;
        show();
      }
    });
    show();
    zone.append(input, text);
    return zone;
  }

  /** The filled file rows as StartFile entries (empty ones are left out), or an error message. */
  private collectFiles(): { files: StartFile[] } | { error: string } {
    const files: StartFile[] = [];
    const seen = new Set<string>();
    for (const row of Array.from(this.modal?.querySelectorAll('.start-file-row') ?? [])) {
      const variable = (row.querySelector('.start-file-variable') as HTMLInputElement).value.trim();
      const kind = (row.querySelector('.start-file-source') as HTMLInputElement).value as FileSource;
      const input = row.querySelector('.start-file-input') as HTMLInputElement | HTMLTextAreaElement;
      const file = kind === 'upload' ? (input as HTMLInputElement).files?.[0] : undefined;
      const text = kind === 'upload' ? '' : input.value.trim();

      if (!file && !text) continue; // nothing given for this variable
      if (!variable) return { error: 'Every file needs the name of the file variable it is for' };
      if (seen.has(variable)) return { error: `More than one file for "${variable}"` };
      seen.add(variable);

      files.push(kind === 'upload' ? { variable, file } : { variable, [kind]: text });
    }
    return { files };
  }

  private async confirmStart(host: string, port: string | number, deploymentId: string, singleProcessDef: string): Promise<void> {
    const resultDiv = this.modal?.querySelector('#start-params-result') as HTMLDivElement | null;
    const processDefSelect = this.modal?.querySelector('#start-params-process-def') as HTMLSelectElement | null;
    const processDef = processDefSelect?.value ?? singleProcessDef;

    let variables: Record<string, unknown>;
    try {
      variables = JSON.parse(this.editor?.getValue() || '{}');
    } catch (error) {
      if (resultDiv) {
        resultDiv.className = 'start-params-result error';
        resultDiv.textContent = `Invalid JSON: ${error instanceof Error ? error.message : 'parse error'}`;
      }
      return;
    }

    const collected = this.collectFiles();
    if ('error' in collected) {
      if (resultDiv) {
        resultDiv.className = 'start-params-result error';
        resultDiv.textContent = collected.error;
      }
      return;
    }
    const forceFileSize = (this.modal?.querySelector('#start-files-force') as HTMLInputElement | null)?.checked ?? false;

    if (resultDiv) {
      resultDiv.className = 'start-params-result testing';
      resultDiv.textContent = collected.files.length > 0 ? `Starting with ${collected.files.length} file(s)...` : 'Starting...';
    }

    const result = await this.deploymentService.startProcessInstance(host, port, deploymentId, processDef, variables, {
      files: collected.files,
      forceFileSize,
    });
    if (resultDiv) {
      const state = !result.success ? 'error' : result.warnings?.length ? 'warning' : 'success';
      resultDiv.className = `start-params-result ${state}`;
      resultDiv.textContent = result.message;
    }
    // created (even if then marked failed, e.g. a file too large): show it on
    // its diagram right away; a plain error keeps the dialog open to fix the input
    const processInstanceId = result.details?.id;
    if (processInstanceId && this.onStarted) {
      showToast(result.message, !result.success ? 'error' : result.warnings?.length ? 'warning' : 'success');
      this.hide();
      this.onStarted(String(processInstanceId));
    }
  }

  private createEditor(): void {
    const container = this.modal?.querySelector('#start-params-editor') as HTMLElement | null;
    if (!container || typeof monaco === 'undefined') {
      return;
    }

    this.editor = monaco.editor.create(container, {
      value: DEFAULT_VARIABLES,
      language: 'json',
      theme: 'vs',
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 13,
      tabSize: 2,
      insertSpaces: true
    });
  }

  private escapeHtml(value: string): string {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }

  private addStyles(): void {
    const styleId = 'start-params-modal-styles';
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .start-params-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .start-params-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--glass-overlay);
      backdrop-filter: blur(4px);
      }

      .start-params-content {
        position: relative;
        background: var(--glass-bg);
        backdrop-filter: var(--glass-blur);
        -webkit-backdrop-filter: var(--glass-blur);
        border: var(--glass-border);
        border-radius: var(--glass-radius);
        box-shadow: var(--glass-shadow);
        width: 90%;
        max-width: 600px;
        display: flex;
        flex-direction: column;
      }

      .start-params-header {
        padding: 20px;
        border-bottom: 1px solid var(--glass-divider);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .start-params-header h2 {
        margin: 0;
        font-size: 20px;
        color: var(--text);
      }

      .start-params-close {
        background: none;
        border: none;
        font-size: 28px;
        color: var(--text-subtle);
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
      }

      .start-params-close:hover {
        background: rgba(255, 255, 255, 0.7);
        color: var(--text);
      }

      .start-params-body {
        padding: 20px;
        max-height: 70vh;
        overflow-y: auto;
      }

      .start-files {
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid var(--glass-divider);
      }

      .start-files-hint {
        font-size: 12px;
      }

      .start-files-hint code {
        padding: 0 5px;
        border-radius: 5px;
        background: rgba(22, 163, 74, 0.1);
        color: var(--accent, #16a34a);
      }

      .start-files-rows {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 10px;
      }

      .start-file-row {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 12px;
        border: var(--glass-control-border, 1px solid #e2e4ef);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.6);
      }

      .start-file-top {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .start-file-row input,
      .start-file-row select,
      .start-file-row textarea {
        width: 100%;
        padding: 7px 10px;
        font: inherit;
        font-size: 13px;
        color: var(--text);
        background: var(--glass-control-bg, white);
        border: var(--glass-control-border, 1px solid #ddd);
        border-radius: 8px;
        box-sizing: border-box;
      }

      .start-file-name {
        flex: 1;
        font-family: ui-monospace, Consolas, monospace;
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
      }

      .start-file-row .start-file-variable {
        flex: 1;
        font-family: ui-monospace, Consolas, monospace;
        font-weight: 600;
      }

      .start-file-row textarea {
        resize: vertical;
        font-family: ui-monospace, Consolas, monospace;
        font-size: 12px;
      }

      .start-file-remove {
        flex: none;
        width: 30px;
        height: 30px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--text-subtle);
        font-size: 18px;
        cursor: pointer;
      }

      .start-file-remove:hover {
        background: rgba(198, 40, 40, 0.08);
        color: #c62828;
      }

      .start-file-sources {
        display: inline-flex;
        align-self: flex-start;
        padding: 3px;
        gap: 2px;
        border-radius: 10px;
        background: rgba(31, 35, 64, 0.06);
      }

      .start-file-sources button {
        padding: 4px 10px;
        border: none;
        border-radius: 7px;
        background: transparent;
        font: inherit;
        font-size: 12px;
        color: var(--text-muted);
        cursor: pointer;
      }

      .start-file-sources button.selected {
        background: white;
        color: var(--text);
        font-weight: 600;
        box-shadow: 0 1px 3px rgba(31, 35, 64, 0.15);
      }

      .start-file-drop {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 46px;
        padding: 8px 12px;
        border: 1.5px dashed var(--glass-divider, #d0d4e4);
        border-radius: 10px;
        font-size: 13px;
        color: var(--text-subtle, #8a8fab);
        cursor: pointer;
        text-align: center;
      }

      .start-file-drop input {
        display: none;
      }

      .start-file-drop:hover,
      .start-file-drop.dragging {
        border-color: var(--accent, #16a34a);
        background: rgba(22, 163, 74, 0.05);
        color: var(--accent, #16a34a);
      }

      .start-file-drop.has-file {
        border-style: solid;
        border-color: rgba(46, 125, 50, 0.4);
        background: rgba(46, 125, 50, 0.05);
        color: #2e7d32;
        font-weight: 600;
      }

      .start-files-force {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        font-size: 12px;
        color: var(--text);
        cursor: pointer;
      }

      .start-files-force input {
        margin-top: 2px;
      }

      .start-files-force em {
        font-style: normal;
        color: #b26a00;
      }

      .start-params-result.warning {
        color: #b26a00;
      }

      .start-params-hint {
        margin: 0 0 10px 0;
        font-size: 13px;
        color: var(--text-muted);
      }

      .start-params-editor {
        height: 180px;
        border: var(--glass-control-border);
        border-radius: 10px;
        overflow: hidden;
      }

      .start-params-label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-muted);
        margin-bottom: 4px;
      }

      .start-params-select {
        width: 100%;
        padding: 8px 10px;
        margin-bottom: 12px;
        border: var(--glass-control-border);
        border-radius: 10px;
        font-size: 13px;
        background: var(--glass-control-bg);
      }

      .start-params-footer {
        padding: 15px 20px;
        border-top: 1px solid var(--glass-divider);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .start-params-result {
        font-size: 13px;
        flex: 1;
        margin-right: 10px;
      }

      .start-params-result.testing {
        color: #1976d2;
      }

      .start-params-result.success {
        color: #2e7d32;
      }

      .start-params-result.error {
        color: #c62828;
      }

      .footer-actions {
        display: flex;
        gap: 10px;
      }

      .btn-primary, .btn-secondary {
        padding: 8px 16px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid transparent;
      }

      .btn-primary {
        background: var(--accent);
        color: white;
        border-color: var(--accent);
      }

      .btn-primary:hover {
        background: #15803d;
        border-color: #15803d;
      }

      .btn-secondary {
        background: var(--glass-control-bg);
        color: var(--text-muted);
        border-color: rgba(255, 255, 255, 0.6);
      }

      .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.7);
        border-color: rgba(255, 255, 255, 0.9);
      }
    `;

    document.head.appendChild(style);
  }
}
