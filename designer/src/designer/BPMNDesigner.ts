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
import { Point, BPMNElement } from './types';

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
    if (!skipUndo) {
      const command = this.undoRedoManager.createAddElementCommand(type, x, y);
      this.undoRedoManager.executeCommand(command);
      // Get the ID of the newly created element
      const elements = this.elementManager.getAllElements();
      const lastElement = elements[elements.length - 1];
      this.render();
      return lastElement ? lastElement.id : '';
    } else {
      const id = this.elementManager.addElement(type, x, y);
      this.render();
      return id;
    }
  }

  public addConnection(sourceId: string, targetId: string, skipUndo: boolean = false): string | null {
    const source = this.elementManager.getElement(sourceId);
    const target = this.elementManager.getElement(targetId);
    
    if (!source || !target) return null;
    
    if (!skipUndo) {
      const command = this.undoRedoManager.createAddConnectionCommand(sourceId, targetId);
      this.undoRedoManager.executeCommand(command);
      this.render();
      // Get the last connection ID
      const connections = this.connectionManager.getAllConnections();
      return connections.length > 0 ? connections[connections.length - 1].id : null;
    } else {
      const id = this.connectionManager.addConnection(sourceId, targetId);
      const connection = this.connectionManager.getConnection(id);
      
      if (connection) {
        this.connectionManager.updateConnectionWaypoints(connection, source, target);
        this.render();
        return id;
      }
      
      return null;
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
    this.hidePropertiesPanel();
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
  
  public exportBPMN(): void {
    const elements = this.elementManager.getAllElements();
    const connections = this.connectionManager.getAllConnections();
    
    const xml = BPMNExporter.exportToXML(elements, connections);
    
    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'process.bpmn';
    a.click();
    URL.revokeObjectURL(url);
  }
  
  public async importBPMN(file: File): Promise<void> {
    const text = await file.text();
    const { elements, connections } = await BPMNExporter.importFromXML(text);
    
    // Clear current diagram
    this.clear();
    
    // Import elements
    elements.forEach(element => {
      this.elementManager.addElement(element.type, element.x, element.y);
      // Update with full element data
      const addedElement = Array.from(this.elementManager.getElementsMap().values()).pop();
      if (addedElement) {
        Object.assign(addedElement, element);
      }
    });
    
    // Import connections
    connections.forEach(connection => {
      this.addConnection(connection.source, connection.target);
    });
    
    this.render();
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
