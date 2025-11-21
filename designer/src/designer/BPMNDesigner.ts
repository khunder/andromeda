import { ElementManager } from './ElementManager';
import { ConnectionManager } from './ConnectionManager';
import { Renderer } from './Renderer';
import { DragHandler } from './DragHandler';
import { ConnectionHandler } from './ConnectionHandler';
import { ConnectionEditor } from './ConnectionEditor';
import { ConnectionInsertHandler } from './ConnectionInsertHandler';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { ConnectionValidator } from './ConnectionValidator';
import { BPMNExporter } from './BPMNExporter';
import { ElementRegistry } from './ElementDefinition';
import { PropertyEditor } from './PropertyEditor';
import { UndoRedoManager } from './UndoRedoManager';
import { Point, BPMNElement, Connection } from './types';
import { ConfigurationManager } from './ConfigurationManager';
import { ConfigurationPanel } from './ConfigurationPanel';
import { DeploymentService } from './DeploymentService';
import { MonacoXMLEditor } from './MonacoXMLEditor';
import { BPMNModdleStore } from './BPMNModdleStore';

export class BPMNDesigner {
  private svg: SVGSVGElement;
  private elementManager: ElementManager;
  private connectionManager: ConnectionManager;
  private renderer: Renderer;
  private dragHandler: DragHandler;
  private connectionHandler: ConnectionHandler;
  private connectionEditor: ConnectionEditor;
  private connectionInsertHandler: ConnectionInsertHandler;
  private contextMenu: ContextMenu;
  private elementRegistry: ElementRegistry;
  private propertyEditor: PropertyEditor | null = null;
  private undoRedoManager: UndoRedoManager;
  private configManager: ConfigurationManager;
  private configPanel: ConfigurationPanel;
  private deploymentService: DeploymentService;
  private xmlEditor: MonacoXMLEditor;
  private moddleStore: BPMNModdleStore;
  
  private selectedElementId: string | null = null;
  private draggedPaletteType: string | null = null;
  private zoom = 1;
  private viewBox = { x: 0, y: 0, width: 1000, height: 600 };
  private isPanning = false;
  private panStartPoint: Point | null = null;

  constructor(container: HTMLElement) {
    // Create SVG
    this.svg = this.createSVG();
    container.appendChild(this.svg);
    
    // Initialize moddle store first
    this.moddleStore = BPMNModdleStore.getInstance();
    
    // Expose moddle store globally for XML editors
    (window as any).moddleStore = this.moddleStore;
    
    // Don't auto-sync on every change - we'll sync manually when needed
    // this.moddleStore.subscribe(() => this.syncFromModdle());
    
    // Initialize managers
    this.elementManager = new ElementManager();
    this.connectionManager = new ConnectionManager();
    this.renderer = new Renderer(this.svg);
    
    // Initialize undo/redo first so it's available for other components
    this.undoRedoManager = new UndoRedoManager(
      this.elementManager,
      this.connectionManager,
      () => this.render()
    );
    
    this.dragHandler = new DragHandler(
      this.elementManager,
      this.connectionManager,
      this.renderer,
      this.svg,
      () => this.render()
    );
    this.connectionHandler = new ConnectionHandler(
      this.svg,
      this.elementManager,
      this.connectionManager,
      (sourceId, targetId) => {
        this.addConnection(sourceId, targetId);
      }
    );
    this.connectionEditor = new ConnectionEditor(
      this.svg,
      this.connectionManager,
      this.elementManager,
      () => this.render()
    );
    // Store references for cross-component communication
    (this.dragHandler as any).connectionEditor = this.connectionEditor;
    (this.dragHandler as any).undoRedoManager = this.undoRedoManager;
    this.connectionInsertHandler = new ConnectionInsertHandler(
      this.svg,
      this.elementManager,
      this.connectionManager,
      () => this.render()
    );
    this.contextMenu = new ContextMenu();
    this.elementRegistry = new ElementRegistry();
    
    // Initialize configuration and deployment
    this.configManager = new ConfigurationManager();
    this.configPanel = new ConfigurationPanel(this.configManager);
    this.deploymentService = new DeploymentService(this.configManager);
    
    // Initialize XML editor
    this.xmlEditor = new MonacoXMLEditor(this.elementManager, this.connectionManager);
    
    // Initialize property editor if container exists
    setTimeout(() => {
      if (document.getElementById('properties-content')) {
        this.propertyEditor = new PropertyEditor(
          'properties-content',
          this.elementManager,
          this.connectionManager,
          this.elementRegistry,
          () => this.render()
        );
      }
    }, 100);
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Setup palette drag and drop
    this.setupPaletteDragDrop();
  }

  private createSVG(): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`);
    svg.style.backgroundColor = '#f5f5f5';
    svg.style.backgroundImage = 'radial-gradient(circle, #ddd 1px, transparent 1px)';
    svg.style.backgroundSize = '20px 20px';
    return svg;
  }

  private setupEventListeners(): void {
    // Left-click handler for selection only
    this.svg.addEventListener('click', (e) => this.handleClick(e));
    
    // Right-click handler for context menu
    this.svg.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
    
    // Mouse events for dragging and connections
    this.svg.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    
    // Wheel event for zoom
    this.svg.addEventListener('wheel', (e) => this.handleWheel(e));
    
    // Keyboard shortcuts - only work when canvas is focused
    document.addEventListener('keydown', (e) => {
      // Check if user is typing in an input field
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.tagName === 'SELECT' ||
                          target.contentEditable === 'true';
      
      if (isInputField) {
        return; // Don't process shortcuts when typing
      }
      
      // Check if canvas or its container has focus
      const canvasContainer = document.getElementById('canvas-container');
      const isCanvasFocused = canvasContainer?.contains(document.activeElement) || 
                             document.activeElement === document.body ||
                             document.activeElement === this.svg;
      
      if (!isCanvasFocused && document.activeElement !== document.body) {
        return; // Don't process if focus is outside canvas area
      }
      
      if (e.key === 'Escape') {
        this.connectionHandler.cancelConnection();
        this.clearSelection();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputField) {
        // Delete selected element or connection
        if (this.selectedElementId) {
          e.preventDefault();
          this.deleteElement(this.selectedElementId, false); // Use undo system
        } else if (this.connectionEditor.getSelectedConnection()) {
          e.preventDefault();
          const selectedConnectionId = this.connectionEditor.getSelectedConnection();
          if (selectedConnectionId) {
            const command = this.undoRedoManager.createDeleteConnectionCommand(selectedConnectionId);
            this.undoRedoManager.executeCommand(command);
            this.connectionEditor.clearSelection();
            this.render();
          }
        }
      } else if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        // Undo
        e.preventDefault();
        this.undoRedoManager.undo();
      } else if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        // Redo
        e.preventDefault();
        this.undoRedoManager.redo();
      }
    });
  }

  private handleClick(e: MouseEvent): void {
    // Don't process if we were dragging
    if ((this as any).wasDragging) {
      (this as any).wasDragging = false;
      return;
    }
    
    // Prevent drag from starting after click
    (this as any).potentialDragElement = null;
    (this as any).potentialDragStart = null;
    
    // Check if clicking on a connection
    const connectionElement = (e.target as Element).closest('[data-connection-id]');
    if (connectionElement) {
      const connectionId = connectionElement.getAttribute('data-connection-id');
      if (connectionId) {
        e.stopPropagation();
        e.preventDefault();
        this.selectConnection(connectionId);
        // Don't show menu on left-click
        return;
      }
    }
    
    // Check if clicking on an element
    const elementGroup = (e.target as Element).closest('[data-element-id]');
    if (elementGroup) {
      const elementId = elementGroup.getAttribute('data-element-id');
      if (elementId) {
        const element = this.elementManager.getElement(elementId);
        if (element) {
          e.stopPropagation();
          e.preventDefault();
          this.selectElement(elementId);
          // Don't show menu on left-click
        }
      }
    } else {
      // Click on empty canvas - just clear selection, no menu
      e.stopPropagation();
      e.preventDefault();
      this.clearSelection();
    }
  }

  private handleMouseDown(e: MouseEvent): void {
    // Reset drag flag
    (this as any).wasDragging = false;
    
    const elementGroup = (e.target as Element).closest('[data-element-id]');
    const connectionElement = (e.target as Element).closest('[data-connection-id]');
    
    if (elementGroup && e.button === 0) {
      const elementId = elementGroup.getAttribute('data-element-id');
      if (elementId) {
        const element = this.elementManager.getElement(elementId);
        if (element) {
          const pt = this.getSVGPoint(e);
          
          // Shift+click starts connection drawing
          if (e.shiftKey) {
            this.connectionHandler.startConnection(element);
            e.preventDefault();
            e.stopPropagation();
          }
          // Alt+click prevents dragging (for menu)
          else if (e.altKey || e.ctrlKey) {
            // Do nothing, let click event handle menu
            return;
          }
          // Regular mousedown prepares for potential drag
          else {
            // We'll start drag on mousemove to allow click selection
            this.prepareDrag(element, pt);
            // Don't prevent default to allow click event
          }
        }
      }
    } else if (!elementGroup && !connectionElement && e.button === 0) {
      // Start panning when clicking on empty canvas
      this.isPanning = true;
      this.panStartPoint = this.getSVGPoint(e);
      e.preventDefault();
      this.svg.style.cursor = 'grabbing';
    }
  }
  
  private prepareDrag(element: BPMNElement, mousePoint: Point): void {
    // Store element for potential drag, but don't start yet
    (this as any).potentialDragElement = element;
    (this as any).potentialDragStart = mousePoint;
  }

  private handleMouseMove(e: MouseEvent): void {
    const pt = this.getSVGPoint(e);
    
    // Handle canvas panning
    if (this.isPanning && this.panStartPoint) {
      const dx = this.panStartPoint.x - pt.x;
      const dy = this.panStartPoint.y - pt.y;
      
      this.viewBox.x += dx;
      this.viewBox.y += dy;
      
      this.svg.setAttribute('viewBox', 
        `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`
      );
      return;
    }
    
    // Handle connection drawing
    if (this.connectionHandler.isDrawingConnection()) {
      this.connectionHandler.updateConnection(pt);
      return;
    }
    
    // Handle dragging
    if (this.dragHandler.isDragging()) {
      this.dragHandler.updateDrag(pt);
      this.render();
      this.dragHandler.maintainShadow();
    }
    // Start drag if mouse moved enough
    else if ((this as any).potentialDragElement) {
      const startPt = (this as any).potentialDragStart;
      const distance = Math.sqrt(Math.pow(pt.x - startPt.x, 2) + Math.pow(pt.y - startPt.y, 2));
      
      if (distance > 5) { // Drag threshold
        this.dragHandler.startDrag((this as any).potentialDragElement, startPt);
        (this as any).potentialDragElement = null;
        (this as any).potentialDragStart = null;
        (this as any).wasDragging = true;
      }
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    // End panning
    if (this.isPanning) {
      this.isPanning = false;
      this.panStartPoint = null;
      this.svg.style.cursor = 'default';
    }
    
    // End connection drawing
    if (this.connectionHandler.isDrawingConnection()) {
      this.connectionHandler.endConnection();
    }
    
    // End dragging
    this.dragHandler.endDrag();
    
    // Clear potential drag
    (this as any).potentialDragElement = null;
    (this as any).potentialDragStart = null;
  }
  
  private handleContextMenu(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if right-clicking on a connection
    const connectionElement = (e.target as Element).closest('[data-connection-id]');
    if (connectionElement) {
      const connectionId = connectionElement.getAttribute('data-connection-id');
      if (connectionId) {
        this.selectConnection(connectionId);
        this.showConnectionContextMenu(connectionId, { x: e.clientX, y: e.clientY });
        return;
      }
    }
    
    // Check if right-clicking on an element
    const elementGroup = (e.target as Element).closest('[data-element-id]');
    if (elementGroup) {
      const elementId = elementGroup.getAttribute('data-element-id');
      if (elementId) {
        const element = this.elementManager.getElement(elementId);
        if (element) {
          this.selectElement(elementId);
          this.showElementContextMenu(element, { x: e.clientX, y: e.clientY });
        }
      }
    } else {
      // Right-click on empty canvas
      this.showCanvasContextMenu({ x: e.clientX, y: e.clientY });
    }
  }
  
  private showElementContextMenu(element: BPMNElement, cursorPosition: Point): void {
    console.log('Showing element context menu for:', element.type);
    
    // Calculate element's screen dimensions
    const rect = this.svg.getBoundingClientRect();
    const viewBox = this.svg.viewBox.baseVal;
    const scaleX = rect.width / viewBox.width;
    const scaleY = rect.height / viewBox.height;
    
    // Get element's screen position and size
    const elementScreenPos = this.getElementScreenPosition(element);
    const elementScreenWidth = element.width * scaleX;
    const elementScreenHeight = element.height * scaleY;
    
    // Position menu outside the element's right boundary with a larger gap
    const menuPosition = {
      x: elementScreenPos.x + elementScreenWidth + 15, // 15px gap after element boundary
      y: elementScreenPos.y // Align to top of element, not centered
    };
    
    const items: ContextMenuItem[] = [];
    
    // Add connection option if element can have outgoing connections
    if (ConnectionValidator.canHaveOutgoingConnections(element)) {
      items.push({
        id: 'connect',
        label: 'Connect to...',
        icon: '→',
        action: () => {
          this.connectionHandler.startConnection(element);
        }
      });
    }
    
    items.push({
      id: 'divider1',
      label: '',
      divider: true,
      action: () => {}
    });
    
    items.push({
      id: 'delete',
      label: 'Delete',
      icon: '🗑',
      action: () => {
        this.deleteElement(element.id);
      }
    });
    
    items.push({
      id: 'properties',
      label: 'Properties',
      icon: '⚙',
      action: () => {
        this.selectElement(element.id);
        // Trigger properties panel update
      }
    });
    
    // Pass element info for smart repositioning if needed
    const elementInfo = {
      ...element,
      screenWidth: elementScreenWidth,
      screenHeight: elementScreenHeight,
      screenX: elementScreenPos.x,
      screenY: elementScreenPos.y
    };
    this.contextMenu.show(items, menuPosition, elementInfo);
  }
  
  private showCanvasContextMenu(position: Point): void {
    const items: ContextMenuItem[] = [
      {
        id: 'add-task',
        label: 'Add User Task',
        icon: '□',
        action: () => {
          const pt = this.getSVGPoint({ clientX: position.x, clientY: position.y } as MouseEvent);
          this.addElement('userTask', pt.x - 50, pt.y - 40);
        }
      },
      {
        id: 'add-gateway',
        label: 'Add Gateway',
        icon: '◇',
        action: () => {
          const pt = this.getSVGPoint({ clientX: position.x, clientY: position.y } as MouseEvent);
          this.addElement('exclusiveGateway', pt.x - 25, pt.y - 25);
        }
      }
    ];
    
    this.contextMenu.show(items, position);
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.setZoom(this.zoom * delta);
  }

  private getSVGPoint(event: MouseEvent): Point {
    const rect = this.svg.getBoundingClientRect();
    const viewBox = this.svg.viewBox.baseVal;
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;
    
    return {
      x: viewBox.x + (event.clientX - rect.left) * scaleX,
      y: viewBox.y + (event.clientY - rect.top) * scaleY
    };
  }
  
  private getElementScreenPosition(element: BPMNElement): Point {
    const rect = this.svg.getBoundingClientRect();
    const viewBox = this.svg.viewBox.baseVal;
    const scaleX = rect.width / viewBox.width;
    const scaleY = rect.height / viewBox.height;
    
    return {
      x: rect.left + (element.x - viewBox.x) * scaleX,
      y: rect.top + (element.y - viewBox.y) * scaleY
    };
  }

  public addElement(type: string, x: number, y: number, skipUndo: boolean = false): string {
    // Generate a unique ID that will be preserved
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    if (!skipUndo) {
      // Pass the ID to the command creator
      const command = this.undoRedoManager.createAddElementCommandWithId(type, x, y, id);
      this.undoRedoManager.executeCommand(command);
      const element = this.elementManager.getElement(id);
      
      if (element) {
        // Sync to moddle store
        this.addElementToModdle(element);
      }
      
      this.render();
      return id;
    } else {
      const elementId = this.elementManager.addElement(type, x, y, id);
      const element = this.elementManager.getElement(elementId);
      
      if (element) {
        // Sync to moddle store
        this.addElementToModdle(element);
      }
      
      this.render();
      return elementId;
    }
  }
  
  /**
   * Add element to moddle store
   */
  private addElementToModdle(element: BPMNElement): void {
    const moddle = this.moddleStore.getModdle();
    const bpmnType = this.mapSimpleTypeToModdleType(element.type);
    
    // Create flow element
    const flowElement = moddle.create(bpmnType, {
      id: element.id,
      name: element.label
    });
    
    // Add without notifying to avoid sync loops
    this.moddleStore.addFlowElement(flowElement, false);
    
    // Create shape
    const shape = moddle.create('bpmndi:BPMNShape', {
      id: `${element.id}_di`,
      bpmnElement: flowElement
    });
    
    shape.bounds = moddle.create('dc:Bounds', {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height
    });
    
    // Add without notifying to avoid sync loops
    this.moddleStore.addShape(shape, false);
  }

  public addConnection(sourceId: string, targetId: string, skipUndo: boolean = false): string | null {
    const source = this.elementManager.getElement(sourceId);
    const target = this.elementManager.getElement(targetId);
    
    if (!source || !target) return null;
    
    // Generate a unique ID that will be preserved
    const id = `Flow_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    if (!skipUndo) {
      const command = this.undoRedoManager.createAddConnectionCommandWithId(sourceId, targetId, id);
      this.undoRedoManager.executeCommand(command);
      this.render();
      const connection = this.connectionManager.getConnection(id);
      
      if (connection) {
        // Sync to moddle store
        this.addConnectionToModdle(connection);
      }
      
      return id;
    } else {
      const connectionId = this.connectionManager.addConnection(sourceId, targetId, id);
      const connection = this.connectionManager.getConnection(connectionId);
      
      if (connection) {
        this.connectionManager.updateConnectionWaypoints(connection, source, target);
        // Sync to moddle store
        this.addConnectionToModdle(connection);
        this.render();
        return connectionId;
      }
      
      return null;
    }
  }
  
  /**
   * Add connection to moddle store
   */
  private addConnectionToModdle(connection: Connection): void {
    const moddle = this.moddleStore.getModdle();
    const process = this.moddleStore.getProcess();
    
    // Find source and target elements in moddle
    const sourceElement = process.flowElements?.find((e: any) => e.id === connection.source);
    const targetElement = process.flowElements?.find((e: any) => e.id === connection.target);
    
    if (sourceElement && targetElement) {
      // Create sequence flow
      const sequenceFlow = moddle.create('bpmn:SequenceFlow', {
        id: connection.id,
        sourceRef: sourceElement,
        targetRef: targetElement,
        name: connection.label
      });
      
      // Add without notifying to avoid sync loops
      this.moddleStore.addFlowElement(sequenceFlow, false);
      
      // Create edge
      const edge = moddle.create('bpmndi:BPMNEdge', {
        id: `${connection.id}_di`,
        bpmnElement: sequenceFlow
      });
      
      edge.waypoint = connection.waypoints.map(wp => 
        moddle.create('dc:Point', { x: wp.x, y: wp.y })
      );
      
      // Add without notifying to avoid sync loops
      this.moddleStore.addEdge(edge, false);
    }
  }

  public selectElement(elementId: string): void {
    this.clearSelection();
    this.selectedElementId = elementId;
    const element = this.elementManager.getElement(elementId);
    if (element) {
      this.renderer.renderSelection(element);
      // Show properties panel
      this.showPropertiesPanel();
      // Show in property editor
      if (this.propertyEditor) {
        this.propertyEditor.editElement(element);
      }
    }
  }

  public clearSelection(): void {
    this.selectedElementId = null;
    this.renderer.removeSelection();
    this.connectionEditor.clearSelection();
    if (this.propertyEditor) {
      this.propertyEditor.clear();
    }
    // Show deployment panel when nothing is selected
    this.showDeploymentPanel();
  }
  private showPropertiesPanel(): void {
    const panel = document.querySelector('.properties-panel');
    if (panel) {
      panel.classList.add('visible');
    }
  }
  
  private hidePropertiesPanel(): void {
    const panel = document.querySelector('.properties-panel');
    if (panel) {
      panel.classList.remove('visible');
    }
  }
  
  private handleSelectionChange(): void {
    // Placeholder for multi-selection handling
    const selectedElements = new Set();
    const selectedConnections = new Set();
    
    if (selectedElements.size > 0) {
      // Show properties panel with multi-selection info
      this.showPropertiesPanel();
      if (this.propertyEditor) {
        // For now, show count of selected elements
        const propertiesContent = document.getElementById('properties-content');
        if (propertiesContent) {
          propertiesContent.innerHTML = `
            <div style="padding: 16px;">
              <h3>Multiple Selection</h3>
              <p>${selectedElements.size} elements selected</p>
              <p>${selectedConnections.size} connections selected</p>
              <p style="color: #666; font-size: 12px; margin-top: 16px;">
                • Use Ctrl/Cmd+Click to add/remove elements<br>
                • Use Shift+Drag to select area<br>
                • Press Delete to remove all selected<br>
                • Drag any selected element to move all
              </p>
            </div>
          `;
        }
      }
    } else {
      this.hidePropertiesPanel();
    }
    
    // Re-render to update visual states
    this.render();
  }
  
  private async handleDeploy(): Promise<void> {
    try {
      // Export BPMN XML from moddle store
      const bpmnXml = await this.moddleStore.toXML(true);
      
      // Get deployment ID
      const deploymentInput = document.getElementById('deployment-id-input') as HTMLInputElement;
      const deploymentId = deploymentInput?.value || this.configManager.getDeploymentId();
      
      if (!deploymentId) {
        alert('Please enter a deployment ID');
        return;
      }
      
      // Show loading state
      const deployButton = document.getElementById('deploy-from-panel') as HTMLButtonElement;
      const originalText = deployButton?.textContent || '';
      if (deployButton) {
        deployButton.disabled = true;
        deployButton.textContent = 'Deploying...';
      }
      
      // Deploy
      const result = await this.deploymentService.deploy(bpmnXml, deploymentId);
      
      // Show result
      if (result.success) {
        alert(`✅ Deployment successful!\n\n${result.message}`);
      } else {
        alert(`❌ Deployment failed!\n\n${result.message}`);
      }
      
      // Restore button state
      if (deployButton) {
        deployButton.disabled = false;
        deployButton.textContent = originalText;
      }
    } catch (error) {
      console.error('Deployment error:', error);
      alert(`❌ Deployment failed!\n\n${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Restore button state
      const deployButton = document.getElementById('deploy-from-panel') as HTMLButtonElement;
      if (deployButton) {
        deployButton.disabled = false;
        deployButton.textContent = '🚀 Deploy to Engine';
      }
    }
  }
  
  private showDeploymentPanel(): void {
    const panel = document.querySelector('.properties-panel');
    if (panel) {
      panel.classList.add('visible');
      const content = document.getElementById('properties-content');
      if (content) {
        content.innerHTML = `
          <div style="padding: 16px;">
            <h3>Deployment Settings</h3>
            <div style="margin-top: 20px;">
              <label style="display: block; font-size: 13px; color: #555; margin-bottom: 5px;">Deployment ID:</label>
              <input 
                type="text" 
                id="deployment-id-input" 
                placeholder="Enter deployment ID" 
                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;"
                value=""
              />
              <small style="display: block; margin-top: 5px; font-size: 11px; color: #999;">Unique identifier for this deployment</small>
            </div>
            <div style="margin-top: 20px;">
              <label style="display: block; font-size: 13px; color: #555; margin-bottom: 5px;">Engine URL:</label>
              <input 
                type="text" 
                id="engine-url-display" 
                readonly
                style="width: 100%; padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 13px; background: #f5f5f5; color: #666;"
                value=""
              />
              <small style="display: block; margin-top: 5px; font-size: 11px; color: #999;">Configure in settings</small>
            </div>
            <div style="margin-top: 25px;">
              <button 
                id="deploy-from-panel" 
                style="width: 100%; padding: 10px; background: #4caf50; color: white; border: none; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer;"
              >
                🚀 Deploy to Engine
              </button>
            </div>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="font-size: 12px; color: #666; line-height: 1.6;">
                <strong>Quick Tips:</strong><br>
                • Use Shift+Drag to select multiple elements<br>
                • Right-click for context menus<br>
                • Drag from palette to add new elements<br>
                • Alt+Shift+Drag to create connections
              </p>
            </div>
          </div>
        `;
        
        // Set the values from configuration
        const deploymentInput = document.getElementById('deployment-id-input') as HTMLInputElement;
        const engineUrlDisplay = document.getElementById('engine-url-display') as HTMLInputElement;
        const deployButton = document.getElementById('deploy-from-panel') as HTMLButtonElement;
        
        if (this.configManager) {
          if (deploymentInput) {
            deploymentInput.value = this.configManager.getDeploymentId() || this.configManager.getLastUsedDeploymentId() || '';
          }
          if (engineUrlDisplay) {
            engineUrlDisplay.value = this.configManager.getEngineUrl();
          }
        }
        
        // Add event listeners
        if (deploymentInput) {
          deploymentInput.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            if (this.configManager) {
              this.configManager.setDeploymentId(value);
            }
          });
        }
        
        if (deployButton) {
          deployButton.addEventListener('click', () => {
            this.handleDeploy();
          });
        }
      }
    }
  }
  
  public selectConnection(connectionId: string): void {
    this.clearSelection();
    this.connectionEditor.selectConnection(connectionId);
    // Show properties panel
    this.showPropertiesPanel();
    // Show in property editor
    const connection = this.connectionManager.getConnection(connectionId);
    if (connection && this.propertyEditor) {
      this.propertyEditor.editConnection(connection);
    }
  }
  
  private showConnectionContextMenu(connectionId: string, position: Point): void {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) return;
    
    const items: ContextMenuItem[] = [
      {
        id: 'add-waypoint',
        label: 'Add Waypoint',
        icon: '+',
        action: () => {
          const pt = this.getSVGPoint({ clientX: position.x, clientY: position.y } as MouseEvent);
          this.connectionEditor.addWaypoint(connectionId, pt);
        }
      },
      {
        id: 'divider1',
        label: '',
        divider: true,
        action: () => {}
      },
      {
        id: 'delete-connection',
        label: 'Delete Connection',
        icon: '🗑',
        action: () => {
          this.connectionManager.deleteConnection(connectionId);
          this.render();
        }
      },
      {
        id: 'properties',
        label: 'Properties',
        icon: '⚙',
        action: () => {
          // Show connection properties
        }
      }
    ];
    
    this.contextMenu.show(items, position);
  }

  public deleteSelected(): void {
    if (this.selectedElementId) {
      this.deleteElement(this.selectedElementId);
    }
  }
  
  public deleteElement(elementId: string, skipUndo: boolean = false): void {
    if (!skipUndo) {
      const command = this.undoRedoManager.createDeleteElementCommand(elementId);
      this.undoRedoManager.executeCommand(command);
    } else {
      // Get incoming and outgoing connections before deletion
      const connections = this.connectionManager.getConnectionsForElement(elementId);
      const incomingConnections = connections.filter(c => c.target === elementId);
      const outgoingConnections = connections.filter(c => c.source === elementId);
      
      // If element has exactly one incoming and one outgoing connection, bridge them
      if (incomingConnections.length === 1 && outgoingConnections.length === 1) {
        const sourceId = incomingConnections[0].source;
        const targetId = outgoingConnections[0].target;
        
        // Check if source and target are different (avoid self-connection)
        if (sourceId !== targetId) {
          // Delete existing connections
          this.connectionManager.deleteConnectionsForElement(elementId);
          
          // Create new connection bridging the gap
          this.addConnection(sourceId, targetId, true);
        } else {
          // Normal deletion if it would create a self-connection
          this.connectionManager.deleteConnectionsForElement(elementId);
        }
      } else {
        // Normal deletion for other cases
        this.connectionManager.deleteConnectionsForElement(elementId);
      }
      
      // Delete element
      this.elementManager.deleteElement(elementId);
    }
    
    // Clear selection if deleted element was selected
    if (this.selectedElementId === elementId) {
      this.clearSelection();
    }
    
    this.render();
  }

  public clear(): void {
    this.elementManager.clear();
    this.connectionManager.clear();
    this.clearSelection();
    this.render();
  }

  public setZoom(zoom: number): void {
    this.zoom = Math.max(0.1, Math.min(5, zoom));
    const centerX = this.viewBox.x + this.viewBox.width / 2;
    const centerY = this.viewBox.y + this.viewBox.height / 2;
    
    this.viewBox.width = 1000 / this.zoom;
    this.viewBox.height = 600 / this.zoom;
    this.viewBox.x = centerX - this.viewBox.width / 2;
    this.viewBox.y = centerY - this.viewBox.height / 2;
    
    this.svg.setAttribute('viewBox', 
      `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`
    );
  }

  public getZoom(): number {
    return this.zoom;
  }
  
  /**
   * Import BPMN from XML string
   */
  public async importFromXML(xml: string): Promise<void> {
    // Load XML into moddle store
    await this.moddleStore.loadFromXML(xml);
    
    // Manually sync from moddle to designer
    this.syncFromModdle();
  }
  
  /**
   * Sync from moddle store to designer
   */
  private syncFromModdle(): void {
    // Get all flow elements from moddle
    const flowElements = this.moddleStore.getAllFlowElements();
    const shapes = this.moddleStore.getAllShapes();
    const edges = this.moddleStore.getAllEdges();
    
    // Create maps of current elements for comparison
    const currentElements = new Map<string, BPMNElement>();
    this.elementManager.getAllElements().forEach(elem => {
      currentElements.set(elem.id, elem);
    });
    
    const currentConnections = new Map<string, Connection>();
    this.connectionManager.getAllConnections().forEach(conn => {
      currentConnections.set(conn.id, conn);
    });
    
    // Track which elements and connections are still in moddle
    const activeElementIds = new Set<string>();
    const activeConnectionIds = new Set<string>();
    
    // Create shape map for quick lookup
    const shapeMap = new Map();
    shapes.forEach(shape => {
      if (shape.bpmnElement) {
        shapeMap.set(shape.bpmnElement.id, shape);
      }
    });
    
    // Update or add flow elements (excluding sequence flows)
    flowElements.forEach(element => {
      if (element.$type !== 'bpmn:SequenceFlow') {
        activeElementIds.add(element.id);
        const shape = shapeMap.get(element.id);
        
        if (shape?.bounds) {
          const existingElement = currentElements.get(element.id);
          const type = this.mapModdleTypeToSimpleType(element.$type);
          
          if (existingElement) {
            // Update existing element
            existingElement.type = type;
            existingElement.x = shape.bounds.x;
            existingElement.y = shape.bounds.y;
            existingElement.width = shape.bounds.width;
            existingElement.height = shape.bounds.height;
            existingElement.label = element.name || '';
          } else {
            // Create new element with preserved ID
            const bpmnElement: BPMNElement = {
              id: element.id,
              type: type,
              x: shape.bounds.x,
              y: shape.bounds.y,
              width: shape.bounds.width,
              height: shape.bounds.height,
              label: element.name || '',
              properties: {}
            };
            
            // Add element with its original ID
            this.elementManager.setElement(bpmnElement);
          }
        }
      }
    });
    
    // Update or add sequence flows
    flowElements.forEach(element => {
      if (element.$type === 'bpmn:SequenceFlow') {
        activeConnectionIds.add(element.id);
        const sourceId = element.sourceRef?.id;
        const targetId = element.targetRef?.id;
        
        if (sourceId && targetId) {
          const existingConnection = currentConnections.get(element.id);
          const edge = edges.find((e: any) => e.bpmnElement?.id === element.id);
          
          if (existingConnection) {
            // Update existing connection
            existingConnection.source = sourceId;
            existingConnection.target = targetId;
            existingConnection.waypoints = edge?.waypoint ? 
              edge.waypoint.map((wp: any) => ({ x: wp.x, y: wp.y })) : 
              existingConnection.waypoints;
            existingConnection.label = element.name || '';
          } else {
            // Create new connection with preserved ID
            const connection: Connection = {
              id: element.id,
              source: sourceId,
              target: targetId,
              waypoints: edge?.waypoint ? 
                edge.waypoint.map((wp: any) => ({ x: wp.x, y: wp.y })) : [],
              label: element.name || ''
            };
            
            // Add connection with its original ID
            this.connectionManager.setConnection(connection);
          }
        }
      }
    });
    
    // Remove elements that no longer exist in moddle
    currentElements.forEach((elem, id) => {
      if (!activeElementIds.has(id)) {
        this.elementManager.deleteElement(id);
      }
    });
    
    // Remove connections that no longer exist in moddle
    currentConnections.forEach((conn, id) => {
      if (!activeConnectionIds.has(id)) {
        this.connectionManager.deleteConnection(id);
      }
    });
    
    // Re-render the designer
    this.render();
  }
  
  /**
   * Sync from designer to moddle store
   */
  private syncToModdle(): void {
    const moddle = this.moddleStore.getModdle();
    const process = this.moddleStore.getProcess();
    const plane = this.moddleStore.getPlane();
    
    // Create maps of existing elements for comparison
    const existingFlowElements = new Map();
    const existingShapes = new Map();
    const existingEdges = new Map();
    
    // Map existing flow elements
    (process.flowElements || []).forEach((elem: any) => {
      existingFlowElements.set(elem.id, elem);
    });
    
    // Map existing shapes and edges
    (plane.planeElement || []).forEach((elem: any) => {
      if (elem.$type === 'bpmndi:BPMNShape') {
        existingShapes.set(elem.bpmnElement?.id, elem);
      } else if (elem.$type === 'bpmndi:BPMNEdge') {
        existingEdges.set(elem.bpmnElement?.id, elem);
      }
    });
    
    // Track which elements are still in use
    const usedElementIds = new Set<string>();
    const usedConnectionIds = new Set<string>();
    
    // Update or add elements
    this.elementManager.getAllElements().forEach(element => {
      usedElementIds.add(element.id);
      
      // Check if element already exists in moddle
      let flowElement = existingFlowElements.get(element.id);
      let shape = existingShapes.get(element.id);
      
      if (flowElement) {
        // Update existing element
        flowElement.name = element.label;
      } else {
        // Create new element
        const bpmnType = this.mapSimpleTypeToModdleType(element.type);
        flowElement = moddle.create(bpmnType, {
          id: element.id,
          name: element.label
        });
        process.flowElements.push(flowElement);
      }
      
      if (shape) {
        // Update existing shape bounds
        if (!shape.bounds) {
          shape.bounds = moddle.create('dc:Bounds');
        }
        shape.bounds.x = element.x;
        shape.bounds.y = element.y;
        shape.bounds.width = element.width;
        shape.bounds.height = element.height;
      } else {
        // Create new shape
        shape = moddle.create('bpmndi:BPMNShape', {
          id: `${element.id}_di`,
          bpmnElement: flowElement
        });
        
        shape.bounds = moddle.create('dc:Bounds', {
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height
        });
        
        plane.planeElement.push(shape);
      }
    });
    
    // Update or add connections
    this.connectionManager.getAllConnections().forEach(connection => {
      usedConnectionIds.add(connection.id);
      
      // Check if connection already exists
      let sequenceFlow = existingFlowElements.get(connection.id);
      let edge = existingEdges.get(connection.id);
      
      const sourceElement = existingFlowElements.get(connection.source) || 
                           process.flowElements.find((e: any) => e.id === connection.source);
      const targetElement = existingFlowElements.get(connection.target) || 
                           process.flowElements.find((e: any) => e.id === connection.target);
      
      if (sourceElement && targetElement) {
        if (sequenceFlow) {
          // Update existing sequence flow
          sequenceFlow.sourceRef = sourceElement;
          sequenceFlow.targetRef = targetElement;
          sequenceFlow.name = connection.label;
        } else {
          // Create new sequence flow
          sequenceFlow = moddle.create('bpmn:SequenceFlow', {
            id: connection.id,
            sourceRef: sourceElement,
            targetRef: targetElement,
            name: connection.label
          });
          process.flowElements.push(sequenceFlow);
        }
        
        if (edge) {
          // Update existing edge waypoints
          edge.waypoint = connection.waypoints.map(wp => 
            moddle.create('dc:Point', { x: wp.x, y: wp.y })
          );
        } else {
          // Create new edge
          edge = moddle.create('bpmndi:BPMNEdge', {
            id: `${connection.id}_di`,
            bpmnElement: sequenceFlow
          });
          
          edge.waypoint = connection.waypoints.map(wp => 
            moddle.create('dc:Point', { x: wp.x, y: wp.y })
          );
          
          plane.planeElement.push(edge);
        }
      }
    });
    
    // Remove elements that no longer exist
    process.flowElements = process.flowElements.filter((elem: any) => {
      if (elem.$type === 'bpmn:SequenceFlow') {
        return usedConnectionIds.has(elem.id);
      } else {
        return usedElementIds.has(elem.id);
      }
    });
    
    // Remove shapes and edges that no longer exist
    plane.planeElement = plane.planeElement.filter((elem: any) => {
      if (elem.$type === 'bpmndi:BPMNShape') {
        return usedElementIds.has(elem.bpmnElement?.id);
      } else if (elem.$type === 'bpmndi:BPMNEdge') {
        return usedConnectionIds.has(elem.bpmnElement?.id);
      }
      return true;
    });
  }
  
  /**
   * Map moddle type to simple type
   */
  private mapModdleTypeToSimpleType(moddleType: string): string {
    const mapping: Record<string, string> = {
      'bpmn:StartEvent': 'startEvent',
      'bpmn:EndEvent': 'endEvent',
      'bpmn:Task': 'task',
      'bpmn:UserTask': 'userTask',
      'bpmn:ServiceTask': 'serviceTask',
      'bpmn:ScriptTask': 'scriptTask',
      'bpmn:ExclusiveGateway': 'exclusiveGateway',
      'bpmn:ParallelGateway': 'parallelGateway'
    };
    return mapping[moddleType] || 'task';
  }
  
  /**
   * Map simple type to moddle type
   */
  private mapSimpleTypeToModdleType(simpleType: string): string {
    const mapping: Record<string, string> = {
      'startEvent': 'bpmn:StartEvent',
      'endEvent': 'bpmn:EndEvent',
      'task': 'bpmn:Task',
      'userTask': 'bpmn:UserTask',
      'serviceTask': 'bpmn:ServiceTask',
      'scriptTask': 'bpmn:ScriptTask',
      'exclusiveGateway': 'bpmn:ExclusiveGateway',
      'parallelGateway': 'bpmn:ParallelGateway'
    };
    return mapping[simpleType] || 'bpmn:Task';
  }
  
  /**
   * Initialize the XML editor
   */
  public initXMLEditor(container: HTMLElement): void {
    this.xmlEditor.init(container);
    
    // Set up XML change handler for syncing
    this.xmlEditor.setOnXmlChange(async (xml: string) => {
      // Only sync if editor is visible to avoid conflicts
      if (this.xmlEditor.getIsVisible()) {
        try {
          await this.importFromXML(xml);
        } catch (error) {
          console.error('Error parsing XML:', error);
          // Don't update if XML is invalid
        }
      }
    });
  }
  
  /**
   * Show the designer view
   */
  public showDesigner(): void {
    const canvas = document.getElementById('bpmn-canvas');
    const xmlEditor = document.getElementById('xml-editor');
    
    if (canvas) canvas.style.display = 'block';
    if (xmlEditor) xmlEditor.style.display = 'none';
    
    this.xmlEditor.hide();
    this.render();
  }
  
  /**
   * Show the XML editor view
   */
  public async showXMLEditor(): Promise<void> {
    const canvas = document.getElementById('bpmn-canvas');
    const xmlEditor = document.getElementById('xml-editor');
    
    if (canvas) canvas.style.display = 'none';
    if (xmlEditor) xmlEditor.style.display = 'block';
    
    // Sync current designer state to moddle
    this.syncToModdle();
    
    // Get XML from moddle store
    const xml = await this.moddleStore.toXML(true);
    
    // Update XML content and show editor
    this.xmlEditor.updateXML(xml);
    this.xmlEditor.show();
  }
  
  /**
   * Toggle between designer and XML views
   */
  public toggleView(): void {
    if (this.xmlEditor.getIsVisible()) {
      this.showDesigner();
    } else {
      this.showXMLEditor();
    }
  }
  
  /**
   * Sync XML editor with current designer state
   */
  public syncXMLEditor(): void {
    if (this.xmlEditor.getIsVisible()) {
      this.xmlEditor.updateXML();
    }
  }

  private render(): void {
    this.renderer.clear();
    
    // Render connections first (so they appear behind elements)
    this.connectionManager.getAllConnections().forEach(connection => {
      this.renderer.renderConnection(connection);
    });
    
    // Render elements
    this.elementManager.getAllElements().forEach(element => {
      this.renderer.renderElement(element);
    });
    
    // Re-apply selection if any
    if (this.selectedElementId) {
      const element = this.elementManager.getElement(this.selectedElementId);
      if (element) {
        this.renderer.renderSelection(element);
      }
    }
    
    // Sync with XML editor if visible
    this.syncXMLEditor();
  }

  public exportSVG(): void {
    const svgData = this.svg.outerHTML;
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bpmn-diagram.svg';
    a.click();
    URL.revokeObjectURL(url);
  }
  
  public async exportBPMN(): Promise<void> {
    // Sync current designer state to moddle
    this.syncToModdle();
    
    // Get XML from moddle store
    const xml = await this.moddleStore.toXML(true);
    
    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'process.bpmn';
    a.click();
    URL.revokeObjectURL(url);
  }
  
  public async importBPMN(file?: File): Promise<void> {
    // If no file provided, open file dialog
    if (!file) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.bpmn,.xml';
      
      input.onchange = async (e) => {
        const target = e.target as HTMLInputElement;
        const selectedFile = target.files?.[0];
        if (selectedFile) {
          await this.importBPMN(selectedFile);
        }
      };
      
      input.click();
      return;
    }
    
    try {
      const text = await file.text();
      await this.importFromXML(text);
      console.log('BPMN file imported successfully');
    } catch (error) {
      console.error('Error importing BPMN file:', error);
      alert('Error importing BPMN file. Please check the file format.');
    }
  }

  // Getters for external access
  public getElements(): BPMNElement[] {
    return this.elementManager.getAllElements();
  }

  public getConnections() {
    return this.connectionManager.getAllConnections();
  }
  
  public getElementRegistry(): ElementRegistry {
    return this.elementRegistry;
  }
  
  public setupPaletteDragDrop(): void {
    // Clear any previous setup
    if ((this.svg as any).__dragListenersAdded) return;
    
    // Wait for palette to be available
    setTimeout(() => {
      const palette = document.querySelector('.palette');
      if (!palette) return;
      
      // Mark as initialized
      (this.svg as any).__dragListenersAdded = true;
      
      // Add drag listeners to palette items
      palette.querySelectorAll('[draggable="true"]').forEach(item => {
        // Check if listener already exists
        if ((item as any).__dragStartListener) return;
        
        const dragStartHandler = (e: Event) => {
          const dragEvent = e as DragEvent;
          const elementType = (e.target as HTMLElement).dataset.elementType;
          if (elementType && dragEvent.dataTransfer) {
            dragEvent.dataTransfer.effectAllowed = 'copy';
            dragEvent.dataTransfer.setData('elementType', elementType);
            this.draggedPaletteType = elementType;
            
            // Add transparency to dragged item
            (e.target as HTMLElement).style.opacity = '0.5';
          }
        };
        
        const dragEndHandler = () => {
          this.draggedPaletteType = null;
          this.connectionInsertHandler.clearHighlight();
          // Restore opacity
          (item as HTMLElement).style.opacity = '1';
        };
        
        item.addEventListener('dragstart', dragStartHandler);
        item.addEventListener('dragend', dragEndHandler);
        
        // Store reference to prevent re-adding
        (item as any).__dragStartListener = dragStartHandler;
        (item as any).__dragEndListener = dragEndHandler;
      });
      
      // Add drag over handler to SVG
      this.svg.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy';
        }
        
        // Check if dragging over a connection
        if (this.draggedPaletteType) {
          const pt = this.getSVGPoint(e as MouseEvent);
          const connectionId = this.connectionInsertHandler.checkConnectionProximity(
            pt,
            this.draggedPaletteType
          );
          
          if (connectionId) {
            this.connectionInsertHandler.highlightConnection(connectionId);
          } else {
            this.connectionInsertHandler.clearHighlight();
          }
        }
      });
      
      // Add drop handler to SVG - only add once
      if (!(this.svg as any).__dropHandler) {
        const dropHandler = (e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          
          const elementType = e.dataTransfer?.getData('elementType');
          if (!elementType || !this.draggedPaletteType) return; // Check draggedPaletteType to ensure we're in a valid drag
          
          const pt = this.getSVGPoint(e as MouseEvent);
          
          // Check if dropping on a highlighted connection
          const highlightedConnection = this.connectionInsertHandler.getHighlightedConnection();
          
          if (highlightedConnection) {
            // Insert node on connection
            const newElementId = this.connectionInsertHandler.insertNodeOnConnection(
              highlightedConnection,
              elementType,
              pt
            );
            
            if (newElementId) {
              this.selectElement(newElementId);
            }
          } else {
            // Normal drop on canvas
            const elementId = this.addElement(elementType, pt.x - 50, pt.y - 40);
            this.selectElement(elementId);
          }
          
          // Clear the dragged type immediately
          this.draggedPaletteType = null;
        };
        
        this.svg.addEventListener('drop', dropHandler);
        (this.svg as any).__dropHandler = dropHandler;
      }
      
      // Add drag leave handler to clear highlights
      this.svg.addEventListener('dragleave', (e) => {
        // Only clear if leaving the SVG entirely
        if (e.target === this.svg) {
          this.connectionInsertHandler.clearHighlight();
        }
      });
    }, 500);
  }
}
