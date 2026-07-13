/**
 * Configuration Panel for BPMN Designer
 * Provides UI for configuring engine settings
 */

import { ConfigurationManager } from './ConfigurationManager';

export class ConfigurationPanel {
  private container: HTMLElement;
  private modal: HTMLDivElement | null = null;
  private configManager: ConfigurationManager;
  private onClose?: () => void;
  
  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
    this.container = document.body;
  }
  
  /**
   * Show the configuration panel
   */
  show(onClose?: () => void): void {
    this.onClose = onClose;
    this.createModal();
  }
  
  /**
   * Hide the configuration panel
   */
  hide(): void {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    if (this.onClose) {
      this.onClose();
    }
  }
  
  /**
   * Create the modal dialog
   */
  private createModal(): void {
    // Remove existing modal if any
    if (this.modal) {
      this.modal.remove();
    }
    
    // Create modal container
    this.modal = document.createElement('div');
    this.modal.className = 'config-modal';
    this.modal.innerHTML = `
      <div class="config-modal-overlay"></div>
      <div class="config-modal-content">
        <div class="config-modal-header">
          <h2>Configuration Settings</h2>
          <button class="config-modal-close" title="Close">×</button>
        </div>
        <div class="config-modal-body">
          <div class="config-section">
            <h3>Andromeda Engine Settings</h3>
            <div class="config-field">
              <label for="engine-url">Engine URL:</label>
              <input type="text" id="engine-url" placeholder="http://127.0.0.1:5000" value="${this.configManager.getEngineUrl()}">
              <small>The base URL of your Andromeda engine instance</small>
            </div>
            <div class="config-field">
              <label for="default-deployment-id">Default Deployment ID:</label>
              <input type="text" id="default-deployment-id" placeholder="my-deployment" value="${this.configManager.getDeploymentId()}">
              <small>Default ID to use for deployments (can be changed per deployment)</small>
            </div>
            <div class="config-field">
              <label for="galaxy-url">Galaxy URL (optional):</label>
              <input type="text" id="galaxy-url" placeholder="http://127.0.0.1:5001" value="${(this.configManager as any).getGalaxyUrl()}">
              <small>Galaxy service base URL for container registry</small>
            </div>
          </div>
          <div class="config-section">
            <h3>Connection Test</h3>
            <div class="config-field">
              <button id="test-connection" class="btn-test">Test Connection</button>
              <div id="test-result" class="test-result"></div>
            </div>
          </div>
        </div>
        <div class="config-modal-footer">
          <button class="btn-secondary" id="btn-reset">Reset to Defaults</button>
          <div class="footer-actions">
            <button class="btn-secondary" id="btn-cancel">Cancel</button>
            <button class="btn-primary" id="btn-save">Save</button>
          </div>
        </div>
      </div>
    `;
    
    // Add styles
    this.addStyles();
    
    // Append to body
    this.container.appendChild(this.modal);
    
    // Setup event handlers
    this.setupEventHandlers();
    
    // Focus on first input
    const firstInput = this.modal.querySelector('#engine-url') as HTMLInputElement;
    if (firstInput) {
      firstInput.focus();
      firstInput.select();
    }
  }
  
  /**
   * Setup event handlers for the modal
   */
  private setupEventHandlers(): void {
    if (!this.modal) return;
    
    // Close button
    const closeBtn = this.modal.querySelector('.config-modal-close');
    closeBtn?.addEventListener('click', () => this.hide());
    
    // Overlay click
    const overlay = this.modal.querySelector('.config-modal-overlay');
    overlay?.addEventListener('click', () => this.hide());
    
    // Cancel button
    const cancelBtn = this.modal.querySelector('#btn-cancel');
    cancelBtn?.addEventListener('click', () => this.hide());
    
    // Save button
    const saveBtn = this.modal.querySelector('#btn-save');
    saveBtn?.addEventListener('click', () => this.save());
    
    // Reset button
    const resetBtn = this.modal.querySelector('#btn-reset');
    resetBtn?.addEventListener('click', () => this.reset());
    
    // Test connection button
    const testBtn = this.modal.querySelector('#test-connection');
    testBtn?.addEventListener('click', () => this.testConnection());
    
    // Enter key saves
    this.modal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !(e.target as HTMLElement).matches('textarea')) {
        this.save();
      } else if (e.key === 'Escape') {
        this.hide();
      }
    });
  }
  
  /**
   * Save the configuration
   */
  private save(): void {
    if (!this.modal) return;
    
    const urlInput = this.modal.querySelector('#engine-url') as HTMLInputElement;
    const deploymentIdInput = this.modal.querySelector('#default-deployment-id') as HTMLInputElement;
    const galaxyUrlInput = this.modal.querySelector('#galaxy-url') as HTMLInputElement;
    
    if (urlInput) {
      this.configManager.setEngineUrl(urlInput.value);
    }
    
    if (deploymentIdInput) {
      this.configManager.setDeploymentId(deploymentIdInput.value);
    }
    if (galaxyUrlInput) {
      (this.configManager as any).setGalaxyUrl(galaxyUrlInput.value);
    }
    
    this.hide();
  }
  
  /**
   * Reset to default values
   */
  private reset(): void {
    if (!this.modal) return;
    
    this.configManager.reset();
    
    const urlInput = this.modal.querySelector('#engine-url') as HTMLInputElement;
    const deploymentIdInput = this.modal.querySelector('#default-deployment-id') as HTMLInputElement;
    
    if (urlInput) {
      urlInput.value = this.configManager.getEngineUrl();
    }
    
    if (deploymentIdInput) {
      deploymentIdInput.value = this.configManager.getDeploymentId();
    }
  }
  
  /**
   * Test connection to the engine
   */
  private async testConnection(): Promise<void> {
    if (!this.modal) return;
    
    const urlInput = this.modal.querySelector('#engine-url') as HTMLInputElement;
    const resultDiv = this.modal.querySelector('#test-result') as HTMLDivElement;
    const testBtn = this.modal.querySelector('#test-connection') as HTMLButtonElement;
    
    if (!urlInput || !resultDiv || !testBtn) return;
    
    const url = urlInput.value || 'http://localhost:5000';
    
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    resultDiv.className = 'test-result testing';
    resultDiv.textContent = 'Connecting to engine...';
    
    try {
      // Try to fetch from the engine's base URL or a health endpoint
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
      });
      
      if (response.ok || response.status === 404) {
        // 404 might be expected if there's no root handler
        resultDiv.className = 'test-result success';
        resultDiv.textContent = '✓ Connection successful';
      } else {
        resultDiv.className = 'test-result error';
        resultDiv.textContent = `✗ Connection failed (HTTP ${response.status})`;
      }
    } catch (error) {
      resultDiv.className = 'test-result error';
      resultDiv.textContent = `✗ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Test Connection';
    }
  }
  
  /**
   * Add styles for the configuration panel
   */
  private addStyles(): void {
    const styleId = 'config-panel-styles';
    
    // Check if styles already exist
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .config-modal {
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
      
      .config-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
      }
      
      .config-modal-content {
        position: relative;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
      }
      
      .config-modal-header {
        padding: 20px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .config-modal-header h2 {
        margin: 0;
        font-size: 20px;
        color: #333;
      }
      
      .config-modal-close {
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
        transition: all 0.2s;
      }
      
      .config-modal-close:hover {
        background: #f5f5f5;
        color: #333;
      }
      
      .config-modal-body {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
      }
      
      .config-section {
        margin-bottom: 25px;
      }
      
      .config-section:last-child {
        margin-bottom: 0;
      }
      
      .config-section h3 {
        font-size: 14px;
        font-weight: 600;
        color: #666;
        margin: 0 0 15px 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .config-field {
        margin-bottom: 15px;
      }
      
      .config-field label {
        display: block;
        font-size: 14px;
        color: #333;
        margin-bottom: 5px;
        font-weight: 500;
      }
      
      .config-field input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        transition: border-color 0.2s;
      }
      
      .config-field input:focus {
        outline: none;
        border-color: #1e88e5;
      }
      
      .config-field small {
        display: block;
        margin-top: 5px;
        font-size: 12px;
        color: #999;
      }
      
      .config-modal-footer {
        padding: 15px 20px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .footer-actions {
        display: flex;
        gap: 10px;
      }
      
      .btn-primary, .btn-secondary, .btn-test {
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
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
      
      .btn-test {
        background: #4caf50;
        color: white;
        border-color: #4caf50;
      }
      
      .btn-test:hover {
        background: #45a049;
        border-color: #45a049;
      }
      
      .btn-test:disabled {
        background: #ccc;
        border-color: #ccc;
        cursor: not-allowed;
      }
      
      .test-result {
        margin-top: 10px;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 13px;
        display: none;
      }
      
      .test-result.testing {
        display: block;
        background: #e3f2fd;
        color: #1976d2;
        border: 1px solid #90caf9;
      }
      
      .test-result.success {
        display: block;
        background: #e8f5e9;
        color: #2e7d32;
        border: 1px solid #81c784;
      }
      
      .test-result.error {
        display: block;
        background: #ffebee;
        color: #c62828;
        border: 1px solid #ef5350;
      }
    `;
    
    document.head.appendChild(style);
  }
}
