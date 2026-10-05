/**
 * Process Start Modal
 * Lets the user edit a JSON variables payload (via Monaco) and start a process
 * instance on the running container with those variables.
 */

import { DeploymentService } from './DeploymentService';
import { loadMonaco } from './MonacoLoader';

declare const monaco: any;

const DEFAULT_VARIABLES = `{
  "age": 20
}`;

export class ProcessStartModal {
  private modal: HTMLDivElement | null = null;
  private editor: any = null;

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

    if (resultDiv) {
      resultDiv.className = 'start-params-result testing';
      resultDiv.textContent = 'Starting...';
    }

    const result = await this.deploymentService.startProcessInstance(host, port, deploymentId, processDef, variables);
    if (resultDiv) {
      resultDiv.className = `start-params-result ${result.success ? 'success' : 'error'}`;
      resultDiv.textContent = result.message;
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
      }

      .start-params-hint {
        margin: 0 0 10px 0;
        font-size: 13px;
        color: var(--text-muted);
      }

      .start-params-editor {
        height: 240px;
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
