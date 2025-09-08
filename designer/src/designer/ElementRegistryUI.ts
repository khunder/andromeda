import { ElementRegistry, ElementDefinition } from './ElementDefinition';

export class ElementRegistryUI {
  private isOpen = false;
  private modal: HTMLDivElement | null = null;
  
  constructor(private elementRegistry: ElementRegistry, private onUpdate: () => void) {}
  
  show(): void {
    if (this.isOpen) return;
    
    this.modal = document.createElement('div');
    this.modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 8px;
      width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    `;
    
    dialog.innerHTML = `
      <div style="padding: 20px;">
        <h2 style="margin: 0 0 20px 0; color: #333;">Register Custom Element</h2>
        
        <form id="element-form">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
              <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Type ID *</label>
              <input type="text" id="elem-type" required placeholder="e.g., customTask" style="
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
              ">
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Label *</label>
              <input type="text" id="elem-label" required placeholder="e.g., Custom Task" style="
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
              ">
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Category</label>
              <select id="elem-category" style="
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
              ">
                <option value="task">Task</option>
                <option value="event">Event</option>
                <option value="gateway">Gateway</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Shape</label>
              <select id="elem-shape" style="
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
              ">
                <option value="rectangle">Rectangle</option>
                <option value="circle">Circle</option>
                <option value="diamond">Diamond</option>
                <option value="hexagon">Hexagon</option>
              </select>
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Width</label>
              <input type="number" id="elem-width" value="100" min="30" max="200" style="
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
              ">
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Height</label>
              <input type="number" id="elem-height" value="80" min="30" max="200" style="
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
              ">
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Fill Color</label>
              <div style="display: flex; gap: 10px;">
                <input type="color" id="elem-fill" value="#ffffff" style="
                  width: 50px;
                  height: 34px;
                  border: 1px solid #ddd;
                  border-radius: 4px;
                  cursor: pointer;
                ">
                <input type="text" id="elem-fill-text" value="#ffffff" style="
                  flex: 1;
                  padding: 8px;
                  border: 1px solid #ddd;
                  border-radius: 4px;
                ">
              </div>
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Stroke Color</label>
              <div style="display: flex; gap: 10px;">
                <input type="color" id="elem-stroke" value="#333333" style="
                  width: 50px;
                  height: 34px;
                  border: 1px solid #ddd;
                  border-radius: 4px;
                  cursor: pointer;
                ">
                <input type="text" id="elem-stroke-text" value="#333333" style="
                  flex: 1;
                  padding: 8px;
                  border: 1px solid #ddd;
                  border-radius: 4px;
                ">
              </div>
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Icon Type</label>
              <select id="elem-icon-type" style="
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
              ">
                <option value="none">None</option>
                <option value="text">Text</option>
                <option value="emoji">Emoji</option>
              </select>
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Icon Content</label>
              <input type="text" id="elem-icon-content" placeholder="e.g., API or 🔧" style="
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
              ">
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Allow Incoming</label>
              <input type="checkbox" id="elem-allow-incoming" checked style="
                width: 20px;
                height: 20px;
                margin-top: 8px;
              ">
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Allow Outgoing</label>
              <input type="checkbox" id="elem-allow-outgoing" checked style="
                width: 20px;
                height: 20px;
                margin-top: 8px;
              ">
            </div>
          </div>
          
          <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
            <button type="button" id="cancel-btn" style="
              padding: 10px 20px;
              background: #f5f5f5;
              border: 1px solid #ddd;
              border-radius: 4px;
              cursor: pointer;
            ">Cancel</button>
            <button type="submit" style="
              padding: 10px 20px;
              background: #1e88e5;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            ">Register Element</button>
          </div>
        </form>
      </div>
    `;
    
    this.modal.appendChild(dialog);
    document.body.appendChild(this.modal);
    
    // Setup event handlers
    this.setupEventHandlers();
    this.isOpen = true;
  }
  
  private setupEventHandlers(): void {
    if (!this.modal) return;
    
    // Sync color inputs
    const fillColor = document.getElementById('elem-fill') as HTMLInputElement;
    const fillText = document.getElementById('elem-fill-text') as HTMLInputElement;
    if (fillColor && fillText) {
      fillColor.addEventListener('input', () => fillText.value = fillColor.value);
      fillText.addEventListener('input', () => fillColor.value = fillText.value);
    }
    
    const strokeColor = document.getElementById('elem-stroke') as HTMLInputElement;
    const strokeText = document.getElementById('elem-stroke-text') as HTMLInputElement;
    if (strokeColor && strokeText) {
      strokeColor.addEventListener('input', () => strokeText.value = strokeColor.value);
      strokeText.addEventListener('input', () => strokeColor.value = strokeText.value);
    }
    
    // Form submission
    const form = document.getElementById('element-form') as HTMLFormElement;
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.registerElement();
      });
    }
    
    // Cancel button
    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close());
    }
    
    // Close on backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });
  }
  
  private registerElement(): void {
    const type = (document.getElementById('elem-type') as HTMLInputElement)?.value;
    const label = (document.getElementById('elem-label') as HTMLInputElement)?.value;
    const category = (document.getElementById('elem-category') as HTMLSelectElement)?.value as any;
    const shape = (document.getElementById('elem-shape') as HTMLSelectElement)?.value as any;
    const width = parseInt((document.getElementById('elem-width') as HTMLInputElement)?.value);
    const height = parseInt((document.getElementById('elem-height') as HTMLInputElement)?.value);
    const fill = (document.getElementById('elem-fill') as HTMLInputElement)?.value;
    const stroke = (document.getElementById('elem-stroke') as HTMLInputElement)?.value;
    const iconType = (document.getElementById('elem-icon-type') as HTMLSelectElement)?.value;
    const iconContent = (document.getElementById('elem-icon-content') as HTMLInputElement)?.value;
    const allowIncoming = (document.getElementById('elem-allow-incoming') as HTMLInputElement)?.checked;
    const allowOutgoing = (document.getElementById('elem-allow-outgoing') as HTMLInputElement)?.checked;
    
    if (!type || !label) {
      alert('Please fill in required fields');
      return;
    }
    
    // Check if type already exists
    if (this.elementRegistry.get(type)) {
      alert(`Element type "${type}" already exists`);
      return;
    }
    
    // Create element definition
    const definition: ElementDefinition = {
      type,
      category,
      label,
      shape,
      defaultSize: { width, height },
      style: {
        fill,
        stroke,
        strokeWidth: 2,
        borderRadius: shape === 'rectangle' ? 5 : 0
      },
      labelPosition: {
        position: 'center',
        offset: { x: 0, y: 0 }
      },
      allowIncoming,
      allowOutgoing
    };
    
    // Add icon if specified
    if (iconType !== 'none' && iconContent) {
      definition.icon = {
        type: iconType === 'emoji' ? 'text' : iconType as any,
        content: iconContent,
        position: { x: 5, y: 5 },
        size: { width: 20, height: 20 }
      };
    }
    
    // Register the element
    this.elementRegistry.register(definition);
    
    // Update palette
    this.updatePalette();
    
    // Close dialog
    this.close();
    
    // Notify
    alert(`Element "${label}" registered successfully!`);
  }
  
  private updatePalette(): void {
    // Get all registered elements
    const allElements = this.elementRegistry.getAll();
    const elementsByCategory = new Map<string, ElementDefinition[]>();
    
    // Group elements by category
    allElements.forEach(elem => {
      const category = elem.category || 'custom';
      if (!elementsByCategory.has(category)) {
        elementsByCategory.set(category, []);
      }
      elementsByCategory.get(category)!.push(elem);
    });
    
    // Update palette for each category with new elements
    elementsByCategory.forEach((elements, category) => {
      // Skip built-in categories that are already in the palette
      if (category === 'event' || category === 'task' || category === 'gateway') {
        // For built-in categories, only add if they're custom types
        elements.forEach(elem => {
          // Check if this is a built-in type
          const builtInTypes = ['startEvent', 'endEvent', 'userTask', 'serviceTask', 'scriptTask', 'exclusiveGateway', 'parallelGateway'];
          if (!builtInTypes.includes(elem.type)) {
            this.addElementToPalette(elem, category);
          }
        });
      } else {
        // For custom category, ensure section exists
        let section = document.querySelector(`.palette-section.${category}`);
        if (!section) {
          const palette = document.querySelector('.palette');
          if (palette) {
            section = document.createElement('div');
            section.className = `palette-section ${category}`;
            section.innerHTML = `<h3>${this.formatCategoryName(category)}</h3>`;
            palette.appendChild(section);
          }
        }
        
        // Add all elements in this category
        if (section) {
          // Clear existing custom items for this category
          const existingItems = section.querySelectorAll('.palette-item[data-custom="true"]');
          existingItems.forEach(item => item.remove());
          
          elements.forEach(elem => {
            const item = document.createElement('div');
            item.className = 'palette-item';
            item.draggable = true;
            item.setAttribute('data-element-type', elem.type);
            item.setAttribute('data-custom', 'true');
            item.setAttribute('title', elem.label);
            // Use first letter of label as icon for custom elements
            item.textContent = elem.icon?.content || elem.label.charAt(0).toUpperCase();
            section.appendChild(item);
            
            // Re-attach drag listeners for new items
            this.attachDragListeners(item, elem.type);
          });
        }
      }
    });
    
    // Notify that palette has been updated
    this.onUpdate();
    
    // Re-setup drag and drop for new elements
    const designer = (window as any).bpmnDesigner;
    if (designer && designer.setupPaletteDragDrop) {
      // Clear previous listeners to re-initialize with new elements
      (designer.svg as any).__dragListenersAdded = false;
      designer.setupPaletteDragDrop();
    }
  }
  
  private close(): void {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    this.isOpen = false;
  }
  
  private formatCategoryName(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1) + ' Elements';
  }
  
  private addElementToPalette(element: ElementDefinition, category: string): void {
    // Find the appropriate section
    let sectionClass = '.palette-section';
    if (category === 'task') sectionClass = '.palette-section:nth-of-type(2)';
    else if (category === 'gateway') sectionClass = '.palette-section:nth-of-type(3)';
    else if (category === 'event') sectionClass = '.palette-section:nth-of-type(1)';
    
    const section = document.querySelector(sectionClass);
    if (section) {
      // Check if element already exists
      const existing = section.querySelector(`[data-element-type="${element.type}"]`);
      if (!existing) {
        const item = document.createElement('div');
        item.className = 'palette-item';
        item.draggable = true;
        item.setAttribute('data-element-type', element.type);
        item.setAttribute('data-custom', 'true');
        item.setAttribute('title', element.label);
        item.textContent = element.icon?.content || element.label.charAt(0).toUpperCase();
        section.appendChild(item);
        
        this.attachDragListeners(item, element.type);
      }
    }
  }
  
  private attachDragListeners(item: HTMLElement, elementType: string): void {
    // Don't add if already attached
    if ((item as any).__dragStartListener) return;
    
    const dragStartHandler = (e: DragEvent) => {
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('elementType', elementType);
        item.style.opacity = '0.5';
      }
    };
    
    const dragEndHandler = () => {
      item.style.opacity = '1';
    };
    
    item.addEventListener('dragstart', dragStartHandler);
    item.addEventListener('dragend', dragEndHandler);
    
    (item as any).__dragStartListener = dragStartHandler;
    (item as any).__dragEndListener = dragEndHandler;
  }
}
