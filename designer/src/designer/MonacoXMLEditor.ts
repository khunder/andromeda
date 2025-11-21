/**
 * Monaco XML Editor component
 * Provides advanced XML editing with syntax highlighting
 */

import { BPMNExporter } from './BPMNExporter';
import { ElementManager } from './ElementManager';
import { ConnectionManager } from './ConnectionManager';

declare const monaco: any;

export class MonacoXMLEditor {
  private editor: any = null;
  private container: HTMLElement | null = null;
  private toolbar: HTMLDivElement | null = null;
  private isVisible: boolean = false;
  private onXmlChange?: (xml: string) => void;
  private isUpdating: boolean = false;
  private monacoLoaded: boolean = false;
  
  constructor(
    private elementManager: ElementManager,
    private connectionManager: ConnectionManager
  ) {}
  
  /**
   * Initialize the Monaco editor
   */
  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    
    // Create toolbar
    this.createToolbar();
    
    // Create editor container
    const editorContainer = document.createElement('div');
    editorContainer.className = 'monaco-editor-container';
    editorContainer.style.height = 'calc(100% - 41px)';
    container.appendChild(editorContainer);
    
    // Load Monaco if not already loaded
    if (!this.monacoLoaded) {
      await this.loadMonaco();
    }
    
    // Create the editor
    if (typeof monaco !== 'undefined') {
      this.editor = monaco.editor.create(editorContainer, {
        value: this.getCurrentXML(),
        language: 'xml',
        theme: 'vs',
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        lineNumbers: 'on',
        renderWhitespace: 'selection',
        wordWrap: 'on',
        formatOnPaste: true,
        formatOnType: false,
        tabSize: 2,
        insertSpaces: true,
        folding: true,
        foldingStrategy: 'indentation',
        scrollbar: {
          vertical: 'auto',
          horizontal: 'auto',
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10
        }
      });
      
      // Add change listener with debounce
      let changeTimeout: any;
      this.editor.onDidChangeModelContent(() => {
        if (!this.isUpdating && this.onXmlChange && this.isVisible) {
          clearTimeout(changeTimeout);
          changeTimeout = setTimeout(() => {
            const xml = this.editor?.getValue() || '';
            if (this.onXmlChange) {
              this.onXmlChange(xml);
            }
            this.updateStatus('Modified', 'warning');
          }, 500); // Debounce for 500ms
        }
      });
      
      // Format on first load
      setTimeout(() => {
        this.editor?.getAction('editor.action.formatDocument')?.run();
      }, 100);
    }
  }
  
  /**
   * Load Monaco Editor from CDN
   */
  private async loadMonaco(): Promise<void> {
    return new Promise((resolve) => {
      // Check if already loading or loaded
      if ((window as any).monaco) {
        this.monacoLoaded = true;
        resolve();
        return;
      }
      
      // Add Monaco loader script
      const loaderScript = document.createElement('script');
      loaderScript.src = 'https://unpkg.com/monaco-editor@0.44.0/min/vs/loader.js';
      loaderScript.onload = () => {
        (window as any).require.config({ 
          paths: { 
            'vs': 'https://unpkg.com/monaco-editor@0.44.0/min/vs' 
          }
        });
        
        (window as any).require(['vs/editor/editor.main'], () => {
          this.monacoLoaded = true;
          resolve();
        });
      };
      
      document.head.appendChild(loaderScript);
    });
  }
  
  /**
   * Create toolbar
   */
  private createToolbar(): void {
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
    
    this.container?.appendChild(this.toolbar);
    
    // Setup button handlers
    const formatBtn = this.toolbar.querySelector('#xml-format');
    formatBtn?.addEventListener('click', () => this.format());
    
    const validateBtn = this.toolbar.querySelector('#xml-validate');
    validateBtn?.addEventListener('click', () => this.validate());
    
    const copyBtn = this.toolbar.querySelector('#xml-copy');
    copyBtn?.addEventListener('click', () => this.copyToClipboard());
    
    // Add styles
    this.addStyles();
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
    if (!this.editor) return;
    
    this.isUpdating = true;
    const newXml = xml || await this.getCurrentXML();
    const currentXml = this.editor.getValue();
    
    // Only update if different
    if (currentXml !== newXml) {
      const position = this.editor.getPosition();
      this.editor.setValue(newXml);
      if (position) {
        this.editor.setPosition(position);
      }
      
      // Format the document
      setTimeout(() => {
        this.editor?.getAction('editor.action.formatDocument')?.run();
      }, 50);
    }
    
    this.isUpdating = false;
    this.updateStatus('Synced', 'success');
  }
  
  /**
   * Get the current XML from the editor
   */
  getXML(): string {
    return this.editor?.getValue() || '';
  }
  
  /**
   * Show the editor
   */
  show(): void {
    this.isVisible = true;
    if (this.container) {
      this.container.style.display = 'block';
      this.updateXML();
      this.editor?.layout();
      this.editor?.focus();
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
   * Format the XML
   */
  format(): void {
    if (this.editor) {
      this.editor.getAction('editor.action.formatDocument')?.run();
      this.updateStatus('Formatted', 'success');
    }
  }
  
  /**
   * Validate the XML
   */
  validate(): void {
    if (!this.editor) return;
    
    try {
      const xml = this.editor.getValue();
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
    if (!this.editor) return;
    
    try {
      await navigator.clipboard.writeText(this.editor.getValue());
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
   * Layout the editor
   */
  layout(): void {
    this.editor?.layout();
  }
  
  /**
   * Add styles
   */
  private addStyles(): void {
    const styleId = 'monaco-xml-editor-styles';
    
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
        height: 41px;
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
      
      .monaco-editor-container {
        width: 100%;
        border: none;
      }
    `;
    
    document.head.appendChild(style);
  }
}
