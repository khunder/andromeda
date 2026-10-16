/**
 * Process Start Modal
 * Lets the user edit a JSON variables payload (via Monaco), attach files to
 * the process's `file` variables (upload, URL, container path or base64), and
 * start a process instance on the running container with them.
 */

import { DeploymentService, type StartFile } from './DeploymentService';
import { loadMonaco } from './MonacoLoader';
import { showToast } from './Toast';

type FileSource = 'upload' | 'url' | 'path' | 'base64';

const SOURCE_LABELS: Record<FileSource, string> = {
  upload: 'Upload',
  url: 'URL',
  path: 'Container path',
  base64: 'Base64',
};

declare const monaco: any;

const DEFAULT_VARIABLES = `{
  "age": 20
}`;

export class ProcessStartModal {
  private modal: HTMLDivElement | null = null;
  private editor: any = null;
  /** Called with the new instance's id once one is created - the dialog then closes. */
  onStarted: ((processInstanceId: string) => void) | null = null;

  constructor(private deploymentService: DeploymentService) {}

  async show(host: string, port: string | number, deploymentId: string, processDefs: string[] = []): Promise<void> {
    this.createModal(host, port, deploymentId, processDefs);
    await loadMonaco();
    this.createEditor();
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
          <p class="start-params-hint">Variables (JSON) for <strong>${this.escapeHtml(deploymentId)}</strong> , this object <em>is</em> your variables, e.g. <code>{"age": 20}</code>. Do not wrap it in a <code>variables</code> key, that's added automatically.</p>
          ${processDefPicker}
          <div id="start-params-editor" class="start-params-editor"></div>

          <div class="start-files">
            <div class="start-files-header">
              <span class="start-params-label">Files</span>
              <button type="button" class="btn-secondary start-files-add" id="btn-add-file">+ Add file</button>
            </div>
            <p class="start-params-hint start-files-hint">For the process's <code>file</code> variables. Small files are kept in the database, bigger ones in object storage.</p>
            <div id="start-files-rows" class="start-files-rows"></div>
            <label class="start-files-force">
              <input type="checkbox" id="start-files-force">
              Accept files above the size limit
              <span class="start-files-force-warning">not recommended - the container stores them anyway and logs a warning</span>
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
    this.modal.querySelector('#btn-add-file')?.addEventListener('click', () => this.addFileRow());
  }

  /** One file row: variable name, source kind, and the source's input. */
  private addFileRow(): void {
    const rows = this.modal?.querySelector('#start-files-rows');
    if (!rows) return;

    const row = document.createElement('div');
    row.className = 'start-file-row';

    const variable = document.createElement('input');
    variable.className = 'start-file-variable';
    variable.placeholder = 'file variable';
    variable.setAttribute('aria-label', 'File variable name');

    const source = document.createElement('select');
    source.className = 'start-file-source';
    source.setAttribute('aria-label', 'File source');
    (Object.keys(SOURCE_LABELS) as FileSource[]).forEach((key) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = SOURCE_LABELS[key];
      source.appendChild(option);
    });

    const valueSlot = document.createElement('div');
    valueSlot.className = 'start-file-value';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'start-file-remove';
    remove.title = 'Remove';
    remove.textContent = '×';
    remove.addEventListener('click', () => row.remove());

    const renderValueInput = () => {
      const kind = source.value as FileSource;
      let input: HTMLInputElement | HTMLTextAreaElement;
      if (kind === 'upload') {
        input = document.createElement('input');
        input.type = 'file';
      } else if (kind === 'base64') {
        input = document.createElement('textarea');
        input.rows = 2;
        input.placeholder = 'base64 or data:...;base64,...';
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.placeholder = kind === 'url' ? 'https://example.org/file.pdf' : 'relative to FILE_INPUT_DIR';
      }
      input.className = 'start-file-input';
      valueSlot.replaceChildren(input);
    };
    source.addEventListener('change', renderValueInput);
    renderValueInput();

    row.append(variable, source, valueSlot, remove);
    rows.appendChild(row);
    variable.focus();
  }

  /** The file rows as StartFile entries, or an error message for an incomplete row. */
  private collectFiles(): { files: StartFile[] } | { error: string } {
    const files: StartFile[] = [];
    const seen = new Set<string>();
    for (const row of Array.from(this.modal?.querySelectorAll('.start-file-row') ?? [])) {
      const variable = (row.querySelector('.start-file-variable') as HTMLInputElement).value.trim();
      const kind = (row.querySelector('.start-file-source') as HTMLSelectElement).value as FileSource;
      const input = row.querySelector('.start-file-input') as HTMLInputElement | HTMLTextAreaElement;
      const file = kind === 'upload' ? (input as HTMLInputElement).files?.[0] : undefined;
      const text = kind === 'upload' ? '' : input.value.trim();

      if (!variable && !file && !text) continue; // untouched row
      if (!variable) return { error: 'Every file needs the name of the file variable it is for' };
      if (seen.has(variable)) return { error: `More than one file for "${variable}"` };
      seen.add(variable);
      if (kind === 'upload' && !file) return { error: `Choose a file for "${variable}"` };
      if (kind !== 'upload' && !text) return { error: `Enter the ${SOURCE_LABELS[kind].toLowerCase()} for "${variable}"` };

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

      .start-files-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
      }

      .start-files-header .start-params-label {
        margin: 0;
      }

      .start-files-add {
        padding: 4px 10px !important;
        font-size: 12px !important;
      }

      .start-files-hint {
        font-size: 12px;
      }

      .start-files-rows {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 10px;
      }

      .start-file-row {
        display: grid;
        grid-template-columns: minmax(110px, 1fr) 130px minmax(160px, 2fr) 28px;
        gap: 6px;
        align-items: start;
      }

      .start-file-row input,
      .start-file-row select,
      .start-file-row textarea {
        width: 100%;
        padding: 6px 8px;
        font: inherit;
        font-size: 13px;
        color: var(--text);
        background: var(--glass-control-bg);
        border: var(--glass-control-border);
        border-radius: 8px;
        box-sizing: border-box;
      }

      .start-file-row textarea {
        resize: vertical;
        font-family: ui-monospace, Consolas, monospace;
        font-size: 12px;
      }

      .start-file-row input[type="file"] {
        padding: 4px;
      }

      .start-file-remove {
        height: 30px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--text-subtle);
        font-size: 18px;
        cursor: pointer;
      }

      .start-file-remove:hover {
        background: rgba(255, 255, 255, 0.7);
        color: #c62828;
      }

      .start-files-force {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--text);
        cursor: pointer;
      }

      .start-files-force-warning {
        flex-basis: 100%;
        padding-left: 22px;
        font-size: 11px;
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
        background: #4a4ae0;
        border-color: #4a4ae0;
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
