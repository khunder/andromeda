/**
 * Simple XML Editor component using textarea
 * Provides basic XML editing capabilities
 */

import { BPMNExporter } from './BPMNExporter';
import { ElementManager } from './ElementManager';
import { ConnectionManager } from './ConnectionManager';

export class SimpleXMLEditor {
  private container: HTMLElement | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private toolbar: HTMLDivElement | null = null;
  private isVisible: boolean = false;
  private onXmlChange?: (xml: string) => void;
  private isUpdating: boolean = false;
  
  constructor(
    private elementManager: ElementManager,
    private connectionManager: ConnectionManager
  ) {}
  
  /**
   * Initialize the editor
   */
  init(container: HTMLElement): void {
    this.container = container;
    
    // Create toolbar
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'xml-editor-toolbar';
    this.toolbar.innerHTML = `
      <button id="xml-format" class="xml-btn" title="Format XML">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="4" y1="6" x2="20" y2="6"/>
          <line x1="4" y1="12" x2="20" y2="12"/>
          <line x1="4" y1="18" x2="20" y2="18"/>
        </svg>
        Format
      </button>
      <button id="xml-validate" class="xml-btn" title="Validate XML">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Validate
      </button>
      <button id="xml-copy" class="xml-btn" title="Copy to Clipboard">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Copy
      </button>
      <div class="xml-status"></div>
    `;
    
    // Create textarea
    this.textarea = document.createElement('textarea');
    this.textarea.className = 'xml-editor-textarea';
    this.textarea.spellcheck = false;
    this.textarea.placeholder = 'BPMN XML will appear here...';
    
    // Add styles
    this.addStyles();
    
    // Append elements
    container.appendChild(this.toolbar);
    container.appendChild(this.textarea);
    
    // Setup event handlers
    this.setupEventHandlers();
    
    // Set initial content
    this.updateXML();
  }
  
  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Textarea change handler
    if (this.textarea) {
      this.textarea.addEventListener('input', () => {
        if (!this.isUpdating && this.onXmlChange && this.isVisible) {
          const xml = this.textarea?.value || '';
          this.onXmlChange(xml);
          this.updateStatus('Modified', 'warning');
        }
      });
      
      // Tab key handler for indentation
      this.textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = this.textarea!.selectionStart;
          const end = this.textarea!.selectionEnd;
          const value = this.textarea!.value;
          this.textarea!.value = value.substring(0, start) + '  ' + value.substring(end);
          this.textarea!.selectionStart = this.textarea!.selectionEnd = start + 2;
        }
      });
    }
    
    // Toolbar button handlers
    if (this.toolbar) {
      const formatBtn = this.toolbar.querySelector('#xml-format');
      formatBtn?.addEventListener('click', () => this.format());
      
      const validateBtn = this.toolbar.querySelector('#xml-validate');
      validateBtn?.addEventListener('click', () => this.validate());
      
      const copyBtn = this.toolbar.querySelector('#xml-copy');
      copyBtn?.addEventListener('click', () => this.copyToClipboard());
    }
  }
  
  /**
   * Get current XML from the designer
   */
  private async getCurrentXML(): Promise<string> {
    // Get XML from moddle store
    const moddleStore = (window as any).moddleStore;
    if (moddleStore) {
      return await moddleStore.toXML(true);
    }
    // Fallback to empty BPMN if store not available
    return '<?xml version="1.0" encoding="UTF-8"?>\n<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn"></definitions>';
  }
  
  /**
   * Update the XML content
   */
  async updateXML(xml?: string): Promise<void> {
    if (!this.textarea) return;
    
    this.isUpdating = true;
    const newXml = xml || await this.getCurrentXML();
    const currentXml = this.textarea.value;
    
    // Only update if different
    if (currentXml !== newXml) {
      const cursorPos = this.textarea.selectionStart;
      this.textarea.value = newXml;
      
      // Try to restore cursor position
      if (cursorPos && cursorPos <= newXml.length) {
        this.textarea.selectionStart = this.textarea.selectionEnd = cursorPos;
      }
    }
    
    this.isUpdating = false;
    this.updateStatus('Synced', 'success');
  }
  
  /**
   * Get the current XML from the editor
   */
  getXML(): string {
    return this.textarea?.value || '';
  }
  
  /**
   * Show the editor
   */
  show(): void {
    this.isVisible = true;
    if (this.container) {
      this.container.style.display = 'block';
      this.updateXML();
      this.textarea?.focus();
    }
  }
  
  /**
   * Hide the editor
   */
  hide(): void {
    this.isVisible = false;
    if (this.container) {
      this.container.style.display = 'none';
    }
  }
  
  /**
   * Check if editor is visible
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }
  
  /**
   * Set the callback for XML changes
   */
  setOnXmlChange(callback: (xml: string) => void): void {
    this.onXmlChange = callback;
  }
  
  /**
   * Format the XML content
   */
  format(): void {
    if (!this.textarea) return;
    
    try {
      const xml = this.textarea.value;
      const formatted = this.formatXML(xml);
      this.textarea.value = formatted;
      this.updateStatus('Formatted', 'success');
    } catch (error) {
      this.updateStatus('Format failed', 'error');
    }
  }
  
  /**
   * Validate the XML
   */
  validate(): void {
    if (!this.textarea) return;
    
    try {
      const xml = this.textarea.value;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      
      const errorNode = doc.querySelector('parsererror');
      if (errorNode) {
        this.updateStatus('Invalid XML', 'error');
      } else {
        this.updateStatus('Valid XML', 'success');
      }
    } catch (error) {
      this.updateStatus('Validation error', 'error');
    }
  }
  
  /**
   * Copy XML to clipboard
   */
  async copyToClipboard(): Promise<void> {
    if (!this.textarea) return;
    
    try {
      await navigator.clipboard.writeText(this.textarea.value);
      this.updateStatus('Copied!', 'success');
      setTimeout(() => this.updateStatus('', ''), 2000);
    } catch (error) {
      this.updateStatus('Copy failed', 'error');
    }
  }
  
  /**
   * Update status message
   */
  private updateStatus(message: string, type: 'success' | 'error' | 'warning' | ''): void {
    const statusEl = this.toolbar?.querySelector('.xml-status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `xml-status ${type}`;
    }
  }
  
  /**
   * Format XML string
   */
  private formatXML(xml: string): string {
    const PADDING = '  ';
    const reg = /(>)(<)(\/*)/g;
    let pad = 0;
    
    xml = xml.replace(reg, '$1\r\n$2$3');
    
    return xml.split('\r\n').map(node => {
      let indent = 0;
      if (node.match(/.+<\/\w[^>]*>$/)) {
        indent = 0;
      } else if (node.match(/^<\/\w/) && pad > 0) {
        pad -= 1;
      } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
        indent = 1;
      } else {
        indent = 0;
      }
      
      const padding = PADDING.repeat(pad);
      pad += indent;
      
      return padding + node;
    }).join('\r\n');
  }
  
  /**
   * Add styles for the editor
   */
  private addStyles(): void {
    const styleId = 'xml-editor-styles';
    
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .xml-editor-toolbar {
        background: #f5f5f5;
        border-bottom: 1px solid #ddd;
        padding: 8px;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      
      .xml-btn {
        padding: 4px 8px;
        background: white;
        border: 1px solid #ccc;
        border-radius: 3px;
        cursor: pointer;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s;
      }
      
      .xml-btn:hover {
        background: #e8f4fd;
        border-color: #1e88e5;
      }
      
      .xml-btn svg {
        width: 14px;
        height: 14px;
      }
      
      .xml-status {
        margin-left: auto;
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 3px;
      }
      
      .xml-status.success {
        background: #e8f5e9;
        color: #2e7d32;
      }
      
      .xml-status.error {
        background: #ffebee;
        color: #c62828;
      }
      
      .xml-status.warning {
        background: #fff3e0;
        color: #e65100;
      }
      
      .xml-editor-textarea {
        width: 100%;
        height: calc(100% - 41px);
        border: none;
        padding: 12px;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.6;
        resize: none;
        outline: none;
        background: white;
        color: #333;
      }
      
      .xml-editor-textarea::selection {
        background: #b3d4fc;
      }
    `;
    
    document.head.appendChild(style);
  }
}
