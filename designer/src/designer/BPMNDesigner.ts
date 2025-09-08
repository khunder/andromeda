import { ElementManager } from './ElementManager';
import { ConnectionManager } from './ConnectionManager';
import { Renderer } from './Renderer';
import { DragHandler } from './DragHandler';
import { ConnectionHandler } from './ConnectionHandler';
import { ConnectionEditor } from './ConnectionEditor';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { ConnectionValidator } from './ConnectionValidator';
import { BPMNExporter } from './BPMNExporter';
import { ElementRegistry } from './ElementDefinition';
import { PropertyEditor } from './PropertyEditor';
import { Point, BPMNElement } from './types';

export class BPMNDesigner {
  private svg: SVGSVGElement;
  private elementManager: ElementManager;
  private connectionManager: ConnectionManager;
  private renderer: Renderer;
  private dragHandler: DragHandler;
  private connectionHandler: ConnectionHandler;
  private connectionEditor: ConnectionEditor;
  private contextMenu: ContextMenu;
  private elementRegistry: ElementRegistry;
  private propertyEditor: PropertyEditor | null = null;
  
  private selectedElementId: string | null = null;
  private zoom = 1;
  private viewBox = { x: 0, y: 0, width: 1000, height: 600 };

  constructor(container: HTMLElement) {
    // Create SVG
    this.svg = this.createSVG();
    container.appendChild(this.svg);
    
    // Initialize managers
    this.elementManager = new ElementManager();
    this.connectionManager = new ConnectionManager();
    this.renderer = new Renderer(this.svg);
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
    // Click handler for selection and context menu
    this.svg.addEventListener('click', (e) => this.handleClick(e));
    
    // Prevent default right-click menu
    this.svg.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Mouse events for dragging and connections
    this.svg.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    
    // Wheel event for zoom
    this.svg.addEventListener('wheel', (e) => this.handleWheel(e));
    
    // Escape key to cancel operations
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.connectionHandler.cancelConnection();
      }
    });
  }

  private handleClick(e: MouseEvent): void {
    // Don't show menu if we were dragging
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
        this.showConnectionContextMenu(connectionId, { x: e.clientX, y: e.clientY });
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
          this.showElementContextMenu(element, { x: e.clientX, y: e.clientY });
        }
      }
    } else {
      // Click on empty canvas
      e.stopPropagation();
      e.preventDefault();
      this.clearSelection();
      this.showCanvasContextMenu({ x: e.clientX, y: e.clientY });
    }
  }

  private handleMouseDown(e: MouseEvent): void {
    // Reset drag flag
    (this as any).wasDragging = false;
    
    const elementGroup = (e.target as Element).closest('[data-element-id]');
    
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
    }
  }
  
  private prepareDrag(element: BPMNElement, mousePoint: Point): void {
    // Store element for potential drag, but don't start yet
    (this as any).potentialDragElement = element;
    (this as any).potentialDragStart = mousePoint;
  }

  private handleMouseMove(e: MouseEvent): void {
    const pt = this.getSVGPoint(e);
    
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
    
    const elementGroup = (e.target as Element).closest('[data-element-id]');
    if (elementGroup) {
      const elementId = elementGroup.getAttribute('data-element-id');
      if (elementId) {
        const element = this.elementManager.getElement(elementId);
        if (element) {
          this.showElementContextMenu(element, { x: e.clientX, y: e.clientY });
        }
      }
    } else {
      this.showCanvasContextMenu({ x: e.clientX, y: e.clientY });
    }
  }
  
  private showElementContextMenu(element: BPMNElement, position: Point): void {
    console.log('Showing element context menu for:', element.type, 'at', position);
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
    
    this.contextMenu.show(items, position);
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

  public addElement(type: string, x: number, y: number): string {
    const id = this.elementManager.addElement(type, x, y);
    this.render();
    return id;
  }

  public addConnection(sourceId: string, targetId: string): string | null {
    const source = this.elementManager.getElement(sourceId);
    const target = this.elementManager.getElement(targetId);
    
    if (!source || !target) return null;
    
    const id = this.connectionManager.addConnection(sourceId, targetId);
    const connection = this.connectionManager.getConnection(id);
    
    if (connection) {
      this.connectionManager.updateConnectionWaypoints(connection, source, target);
      this.render();
      return id;
    }
    
    return null;
  }

  public selectElement(elementId: string): void {
    this.clearSelection();
    this.selectedElementId = elementId;
    const element = this.elementManager.getElement(elementId);
    if (element) {
      this.renderer.renderSelection(element);
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
  }
  
  public selectConnection(connectionId: string): void {
    this.clearSelection();
    this.connectionEditor.selectConnection(connectionId);
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
  
  public deleteElement(elementId: string): void {
    // Delete connections
    this.connectionManager.deleteConnectionsForElement(elementId);
    
    // Delete element
    this.elementManager.deleteElement(elementId);
    
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
}
