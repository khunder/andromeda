import { BPMNElement, Connection } from './types';
import { ElementManager } from './ElementManager';
import { ConnectionManager } from './ConnectionManager';
import { ElementRegistry, ElementDefinition, LabelPosition } from './ElementDefinition';

export class PropertyEditor {
  private container: HTMLElement;
  private currentElement: BPMNElement | null = null;
  private currentConnection: Connection | null = null;
  private elementRegistry: ElementRegistry;
  
  constructor(
    containerId: string,
    private elementManager: ElementManager,
    private connectionManager: ConnectionManager,
    elementRegistry: ElementRegistry,
    private onUpdate: () => void
  ) {
    this.elementRegistry = elementRegistry;
    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`Property editor container not found: ${containerId}`);
    }
    this.container = element;
    this.render();
  }
  
  private render(): void {
    this.container.innerHTML = `
      <div class="property-editor">
        <p style="color: #999; font-size: 13px; text-align: center; padding: 20px;">
          Select an element or connection to edit properties
        </p>
      </div>
    `;
  }
  
  editElement(element: BPMNElement): void {
    this.currentElement = element;
    this.currentConnection = null;
    
    const definition = this.elementRegistry.get(element.type);
    
    this.container.innerHTML = `
      <div class="property-editor">
        <div class="property-section">
          <h4 style="margin: 0 0 15px 0; color: #333; font-size: 14px;">Element Properties</h4>
          
          <div class="property-group">
            <label>ID</label>
            <input type="text" id="prop-id" value="${element.id}" readonly style="background: #f5f5f5;">
          </div>
          
          <div class="property-group">
            <label>Type</label>
            <input type="text" value="${element.type}" readonly style="background: #f5f5f5;">
          </div>
          
          <div class="property-group">
            <label>Label</label>
            <input type="text" id="prop-label" value="${element.label || ''}">
          </div>
          
          <div class="property-group">
            <label>Position</label>
            <div style="display: flex; gap: 10px;">
              <input type="number" id="prop-x" value="${element.x}" style="width: 50%;" placeholder="X">
              <input type="number" id="prop-y" value="${element.y}" style="width: 50%;" placeholder="Y">
            </div>
          </div>
          
          <div class="property-group">
            <label>Size</label>
            <div style="display: flex; gap: 10px;">
              <input type="number" id="prop-width" value="${element.width}" style="width: 50%;" placeholder="Width">
              <input type="number" id="prop-height" value="${element.height}" style="width: 50%;" placeholder="Height">
            </div>
          </div>
        </div>
        
        <div class="property-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <h4 style="margin: 0 0 15px 0; color: #333; font-size: 14px;">Style</h4>
          
          <div class="property-group">
            <label>Fill Color</label>
            <div style="display: flex; gap: 10px; align-items: center;">
              <input type="color" id="prop-fill" value="${this.getElementStyle(element, definition, 'fill')}" style="width: 50px; height: 30px;">
              <input type="text" id="prop-fill-text" value="${this.getElementStyle(element, definition, 'fill')}" style="flex: 1;">
            </div>
          </div>
          
          <div class="property-group">
            <label>Stroke Color</label>
            <div style="display: flex; gap: 10px; align-items: center;">
              <input type="color" id="prop-stroke" value="${this.getElementStyle(element, definition, 'stroke')}" style="width: 50px; height: 30px;">
              <input type="text" id="prop-stroke-text" value="${this.getElementStyle(element, definition, 'stroke')}" style="flex: 1;">
            </div>
          </div>
          
          <div class="property-group">
            <label>Stroke Width</label>
            <input type="number" id="prop-stroke-width" value="${this.getElementStyle(element, definition, 'strokeWidth')}" min="1" max="10">
          </div>
        </div>
        
        <div class="property-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <h4 style="margin: 0 0 15px 0; color: #333; font-size: 14px;">Label Position</h4>
          
          <div class="property-group">
            <label>Position</label>
            <select id="prop-label-position">
              <option value="top" ${this.getLabelPosition(element, definition) === 'top' ? 'selected' : ''}>Top</option>
              <option value="bottom" ${this.getLabelPosition(element, definition) === 'bottom' ? 'selected' : ''}>Bottom</option>
              <option value="left" ${this.getLabelPosition(element, definition) === 'left' ? 'selected' : ''}>Left</option>
              <option value="right" ${this.getLabelPosition(element, definition) === 'right' ? 'selected' : ''}>Right</option>
              <option value="center" ${this.getLabelPosition(element, definition) === 'center' ? 'selected' : ''}>Center</option>
            </select>
          </div>
          
          <div class="property-group">
            <label>Offset</label>
            <div style="display: flex; gap: 10px;">
              <input type="number" id="prop-label-offset-x" value="${this.getLabelOffset(element, definition, 'x')}" style="width: 50%;" placeholder="X">
              <input type="number" id="prop-label-offset-y" value="${this.getLabelOffset(element, definition, 'y')}" style="width: 50%;" placeholder="Y">
            </div>
          </div>
        </div>
        
        ${element.type === 'scriptTask' ? this.renderScriptTaskProperties(element) : ''}
        
        <div style="margin-top: 20px;">
          <button id="apply-properties" style="
            width: 100%;
            padding: 10px;
            background: #1e88e5;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">Apply Changes</button>
        </div>
      </div>
    `;
    
    this.attachElementEventListeners();
  }
  
  private renderScriptTaskProperties(element: BPMNElement): string {
    const script = element.properties?.script || '';
    const language = element.properties?.scriptLanguage || 'javascript';
    
    return `
      <div class="property-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
        <h4 style="margin: 0 0 15px 0; color: #333; font-size: 14px;">Script Properties</h4>
        
        <div class="property-group">
          <label>Language</label>
          <select id="prop-script-language">
            <option value="javascript" ${language === 'javascript' ? 'selected' : ''}>JavaScript</option>
            <option value="python" ${language === 'python' ? 'selected' : ''}>Python</option>
            <option value="groovy" ${language === 'groovy' ? 'selected' : ''}>Groovy</option>
          </select>
        </div>
        
        <div class="property-group">
          <label>Script</label>
          <textarea id="prop-script" rows="10" style="
            width: 100%;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            resize: vertical;
          ">${script}</textarea>
        </div>
      </div>
    `;
  }
  
  editConnection(connection: Connection): void {
    this.currentConnection = connection;
    this.currentElement = null;
    
    this.container.innerHTML = `
      <div class="property-editor">
        <div class="property-section">
          <h4 style="margin: 0 0 15px 0; color: #333; font-size: 14px;">Connection Properties</h4>
          
          <div class="property-group">
            <label>ID</label>
            <input type="text" value="${connection.id}" readonly style="background: #f5f5f5;">
          </div>
          
          <div class="property-group">
            <label>Label</label>
            <input type="text" id="conn-label" value="${connection.label || ''}">
          </div>
          
          <div class="property-group">
            <label>Source</label>
            <input type="text" value="${connection.source}" readonly style="background: #f5f5f5;">
          </div>
          
          <div class="property-group">
            <label>Target</label>
            <input type="text" value="${connection.target}" readonly style="background: #f5f5f5;">
          </div>
        </div>
        
        <div class="property-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <h4 style="margin: 0 0 15px 0; color: #333; font-size: 14px;">Style</h4>
          
          <div class="property-group">
            <label>Line Style</label>
            <select id="conn-style">
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
          
          <div class="property-group">
            <label>Color</label>
            <div style="display: flex; gap: 10px; align-items: center;">
              <input type="color" id="conn-color" value="#333333" style="width: 50px; height: 30px;">
              <input type="text" id="conn-color-text" value="#333333" style="flex: 1;">
            </div>
          </div>
          
          <div class="property-group">
            <label>Width</label>
            <input type="number" id="conn-width" value="2" min="1" max="5">
          </div>
        </div>
        
        <div style="margin-top: 20px;">
          <button id="apply-connection-properties" style="
            width: 100%;
            padding: 10px;
            background: #1e88e5;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">Apply Changes</button>
        </div>
      </div>
    `;
    
    this.attachConnectionEventListeners();
  }
  
  private attachElementEventListeners(): void {
    // Sync color inputs
    const fillColor = document.getElementById('prop-fill') as HTMLInputElement;
    const fillText = document.getElementById('prop-fill-text') as HTMLInputElement;
    if (fillColor && fillText) {
      fillColor.addEventListener('input', () => fillText.value = fillColor.value);
      fillText.addEventListener('input', () => fillColor.value = fillText.value);
    }
    
    const strokeColor = document.getElementById('prop-stroke') as HTMLInputElement;
    const strokeText = document.getElementById('prop-stroke-text') as HTMLInputElement;
    if (strokeColor && strokeText) {
      strokeColor.addEventListener('input', () => strokeText.value = strokeColor.value);
      strokeText.addEventListener('input', () => strokeColor.value = strokeText.value);
    }
    
    // Apply button
    const applyBtn = document.getElementById('apply-properties');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.applyElementChanges());
    }
  }
  
  private attachConnectionEventListeners(): void {
    // Sync color inputs
    const connColor = document.getElementById('conn-color') as HTMLInputElement;
    const connColorText = document.getElementById('conn-color-text') as HTMLInputElement;
    if (connColor && connColorText) {
      connColor.addEventListener('input', () => connColorText.value = connColor.value);
      connColorText.addEventListener('input', () => connColor.value = connColorText.value);
    }
    
    // Apply button
    const applyBtn = document.getElementById('apply-connection-properties');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.applyConnectionChanges());
    }
  }
  
  private applyElementChanges(): void {
    if (!this.currentElement) return;
    
    // Update basic properties
    const label = (document.getElementById('prop-label') as HTMLInputElement)?.value;
    const x = parseFloat((document.getElementById('prop-x') as HTMLInputElement)?.value);
    const y = parseFloat((document.getElementById('prop-y') as HTMLInputElement)?.value);
    const width = parseFloat((document.getElementById('prop-width') as HTMLInputElement)?.value);
    const height = parseFloat((document.getElementById('prop-height') as HTMLInputElement)?.value);
    
    // Update style
    const fill = (document.getElementById('prop-fill') as HTMLInputElement)?.value;
    const stroke = (document.getElementById('prop-stroke') as HTMLInputElement)?.value;
    const strokeWidth = parseFloat((document.getElementById('prop-stroke-width') as HTMLInputElement)?.value);
    
    // Update label position
    const labelPosition = (document.getElementById('prop-label-position') as HTMLSelectElement)?.value;
    const labelOffsetX = parseFloat((document.getElementById('prop-label-offset-x') as HTMLInputElement)?.value) || 0;
    const labelOffsetY = parseFloat((document.getElementById('prop-label-offset-y') as HTMLInputElement)?.value) || 0;
    
    // Create properties object
    const properties = this.currentElement.properties || {};
    
    // Update script task properties if applicable
    if (this.currentElement.type === 'scriptTask') {
      const scriptLanguage = (document.getElementById('prop-script-language') as HTMLSelectElement)?.value;
      const script = (document.getElementById('prop-script') as HTMLTextAreaElement)?.value;
      
      properties.scriptLanguage = scriptLanguage;
      properties.script = script;
    }
    
    // Store style and label properties
    properties.style = { fill, stroke, strokeWidth };
    properties.labelPosition = {
      position: labelPosition,
      offset: { x: labelOffsetX, y: labelOffsetY }
    };
    
    // Update element
    this.elementManager.updateElement(this.currentElement.id, {
      label,
      x,
      y,
      width,
      height,
      properties
    });
    
    // Update element definition if needed
    const definition = this.elementRegistry.get(this.currentElement.type);
    if (definition) {
      this.elementRegistry.update(this.currentElement.type, {
        style: { fill, stroke, strokeWidth },
        labelPosition: properties.labelPosition
      });
    }
    
    this.onUpdate();
  }
  
  private applyConnectionChanges(): void {
    if (!this.currentConnection) return;
    
    const label = (document.getElementById('conn-label') as HTMLInputElement)?.value;
    
    // Update connection
    this.currentConnection.label = label;
    
    this.onUpdate();
  }
  
  private getElementStyle(element: BPMNElement, definition: ElementDefinition | undefined, property: string): string {
    if (element.properties?.style?.[property]) {
      return element.properties.style[property];
    }
    if (definition?.style?.[property]) {
      return definition.style[property];
    }
    
    // Defaults
    const defaults: any = {
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: '2'
    };
    return defaults[property] || '';
  }
  
  private getLabelPosition(element: BPMNElement, definition: ElementDefinition | undefined): string {
    if (element.properties?.labelPosition?.position) {
      return element.properties.labelPosition.position;
    }
    if (definition?.labelPosition?.position) {
      return definition.labelPosition.position;
    }
    return 'center';
  }
  
  private getLabelOffset(element: BPMNElement, definition: ElementDefinition | undefined, axis: 'x' | 'y'): number {
    if (element.properties?.labelPosition?.offset?.[axis] !== undefined) {
      return element.properties.labelPosition.offset[axis];
    }
    if (definition?.labelPosition?.offset?.[axis] !== undefined) {
      return definition.labelPosition.offset[axis];
    }
    return 0;
  }
  
  clear(): void {
    this.currentElement = null;
    this.currentConnection = null;
    this.render();
  }
}
