/**
 * Process Start Modal
 * Lets the user edit a JSON variables payload (via Monaco) and start a process
 * instance on the running container with those variables.
 */

import { DeploymentService } from './DeploymentService';

declare const monaco: any;

const DEFAULT_VARIABLES = `{
  "age": 20
}`;

export class ProcessStartModal {
  private modal: HTMLDivElement | null = null;
  private editor: any = null;

  constructor(private deploymentService: DeploymentService) {}

  async show(host: string, port: string | number, deploymentId: string): Promise<void> {
    this.createModal(host, port, deploymentId);
    await this.loadMonaco();
    this.createEditor();
  }

  hide(): void {
    this.editor?.dispose();
    this.editor = null;
    this.modal?.remove();
    this.modal = null;
  }

  private createModal(host: string, port: string | number, deploymentId: string): void {
    if (this.modal) {
      this.modal.remove();
    }

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
          <p class="start-params-hint">Variables (JSON) for <strong>${this.escapeHtml(deploymentId)}</strong></p>
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

    this.modal.querySelector('.start-params-close')?.addEventListener('click', () => this.hide());
    this.modal.querySelector('.start-params-overlay')?.addEventListener('click', () => this.hide());
    this.modal.querySelector('#btn-cancel-start')?.addEventListener('click', () => this.hide());
    this.modal.querySelector('#btn-confirm-start')?.addEventListener('click', () => void this.confirmStart(host, port, deploymentId));
  }

  private async confirmStart(host: string, port: string | number, deploymentId: string): Promise<void> {
    const resultDiv = this.modal?.querySelector('#start-params-result') as HTMLDivElement | null;

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

    const result = await this.deploymentService.startProcessInstance(host, port, deploymentId, variables);
    if (resultDiv) {
      resultDiv.className = `start-params-result ${result.success ? 'success' : 'error'}`;
      resultDiv.textContent = result.message;
    }
  }

  private async loadMonaco(): Promise<void> {
    return new Promise((resolve) => {
      if ((window as any).monaco) {
        resolve();
        return;
      }

      const loaderScript = document.createElement('script');
      loaderScript.src = 'https://unpkg.com/monaco-editor@0.44.0/min/vs/loader.js';
      loaderScript.onload = () => {
        (window as any).require.config({
          paths: {
            vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs'
          }
        });

        (window as any).require(['vs/editor/editor.main'], () => {
          resolve();
        });
      };

      document.head.appendChild(loaderScript);
    });
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
        background: rgba(0, 0, 0, 0.5);
      }

      .start-params-content {
        position: relative;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        width: 90%;
        max-width: 600px;
        display: flex;
        flex-direction: column;
      }

      .start-params-header {
        padding: 20px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .start-params-header h2 {
        margin: 0;
        font-size: 20px;
        color: #333;
      }

      .start-params-close {
        background: none;
        border: none;
        font-size: 28px;
        color: #999;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }

      .start-params-close:hover {
        background: #f5f5f5;
        color: #333;
      }

      .start-params-body {
        padding: 20px;
      }

      .start-params-hint {
        margin: 0 0 10px 0;
        font-size: 13px;
        color: #666;
      }

      .start-params-editor {
        height: 240px;
        border: 1px solid #ddd;
        border-radius: 4px;
        overflow: hidden;
      }

      .start-params-footer {
        padding: 15px 20px;
        border-top: 1px solid #e0e0e0;
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
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid transparent;
      }

      .btn-primary {
        background: #1e88e5;
        color: white;
        border-color: #1e88e5;
      }

      .btn-primary:hover {
        background: #1976d2;
        border-color: #1976d2;
      }

      .btn-secondary {
        background: white;
        color: #666;
        border-color: #ddd;
      }

      .btn-secondary:hover {
        background: #f5f5f5;
        border-color: #999;
      }
    `;

    document.head.appendChild(style);
  }
}
