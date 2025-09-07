// Main BPMN Designer class

import { EventBus } from './core/EventBus';
import { Canvas } from './core/Canvas';
import { TaskRenderer } from './renderer/TaskRenderer';
import { EventRenderer } from './renderer/EventRenderer';
import { GatewayRenderer } from './renderer/GatewayRenderer';
import { BaseRenderer } from './renderer/BaseRenderer';
import { 
  BPMNElement, 
  BPMNElementType, 
  Connection,
  ModelerOptions,
  ViewerOptions,
  Point
} from './types';

export class BPMNDesigner {
  private eventBus: EventBus;
  private canvas: Canvas;
  private elements: Map<string, BPMNElement>;
  private connections: Map<string, Connection>;
  private renderers: Map<BPMNElementType, BaseRenderer>;
  private selectedElement: string | null = null;
  private options: ModelerOptions | ViewerOptions;

  constructor(options: ModelerOptions | ViewerOptions) {
    this.options = options;
    this.eventBus = new EventBus();
    this.canvas = new Canvas(options.container, this.eventBus);
    this.elements = new Map();
    this.connections = new Map();
    this.renderers = new Map();
    
    this.initializeRenderers();
    this.setupInteractions();
    
    if (options.xml) {
      this.importXML(options.xml);
    }
  }

  private initializeRenderers(): void {
    const taskRenderer = new TaskRenderer();
    const eventRenderer = new EventRenderer();
    const gatewayRenderer = new GatewayRenderer();
    
    // Register task renderers
    this.renderers.set(BPMNElementType.TASK, taskRenderer);
    this.renderers.set(BPMNElementType.USER_TASK, taskRenderer);
    this.renderers.set(BPMNElementType.SERVICE_TASK, taskRenderer);
    this.renderers.set(BPMNElementType.SCRIPT_TASK, taskRenderer);
    this.renderers.set(BPMNElementType.BUSINESS_RULE_TASK, taskRenderer);
    this.renderers.set(BPMNElementType.SEND_TASK, taskRenderer);
    this.renderers.set(BPMNElementType.RECEIVE_TASK, taskRenderer);
    this.renderers.set(BPMNElementType.MANUAL_TASK, taskRenderer);
    
    // Register event renderers
    this.renderers.set(BPMNElementType.START_EVENT, eventRenderer);
    this.renderers.set(BPMNElementType.END_EVENT, eventRenderer);
    this.renderers.set(BPMNElementType.INTERMEDIATE_CATCH_EVENT, eventRenderer);
    this.renderers.set(BPMNElementType.INTERMEDIATE_THROW_EVENT, eventRenderer);
    this.renderers.set(BPMNElementType.BOUNDARY_EVENT, eventRenderer);
    
    // Register gateway renderers
    this.renderers.set(BPMNElementType.EXCLUSIVE_GATEWAY, gatewayRenderer);
    this.renderers.set(BPMNElementType.PARALLEL_GATEWAY, gatewayRenderer);
    this.renderers.set(BPMNElementType.INCLUSIVE_GATEWAY, gatewayRenderer);
    this.renderers.set(BPMNElementType.EVENT_BASED_GATEWAY, gatewayRenderer);
    this.renderers.set(BPMNElementType.COMPLEX_GATEWAY, gatewayRenderer);
  }

  private setupInteractions(): void {
    const svg = this.canvas.getSVG();
    
    // Selection
    svg.addEventListener('click', (e) => {
      const target = e.target as SVGElement;
      const elementGroup = target.closest('[data-element-id]') as SVGElement;
      
      if (elementGroup) {
        const elementId = elementGroup.getAttribute('data-element-id');
        if (elementId) {
          this.selectElement(elementId);
        }
      } else {
        this.clearSelection();
      }
    });
    
    // Drag and drop
    let isDragging = false;
    let dragElement: BPMNElement | null = null;
    let dragOffset: Point = { x: 0, y: 0 };
    
    svg.addEventListener('mousedown', (e) => {
      const target = e.target as SVGElement;
      const elementGroup = target.closest('[data-element-id]') as SVGElement;
      
      if (elementGroup && e.button === 0 && !e.ctrlKey) {
        const elementId = elementGroup.getAttribute('data-element-id');
        if (elementId) {
          const element = this.elements.get(elementId);
          if (element) {
            isDragging = true;
            dragElement = element;
            const svgPoint = this.canvas.screenToSVG({ x: e.clientX, y: e.clientY });
            dragOffset = {
              x: svgPoint.x - element.bounds.x,
              y: svgPoint.y - element.bounds.y
            };
            e.preventDefault();
          }
        }
      }
    });
    
    window.addEventListener('mousemove', (e) => {
      if (isDragging && dragElement) {
        const svgPoint = this.canvas.screenToSVG({ x: e.clientX, y: e.clientY });
        const oldX = dragElement.bounds.x;
        const oldY = dragElement.bounds.y;
        dragElement.bounds.x = svgPoint.x - dragOffset.x;
        dragElement.bounds.y = svgPoint.y - dragOffset.y;
        
        // Update connections
        this.updateConnectionsForElement(dragElement.id, oldX, oldY);
        
        this.render();
      }
    });
    
    window.addEventListener('mouseup', () => {
      isDragging = false;
      dragElement = null;
    });
  }

  private selectElement(elementId: string): void {
    this.clearSelection();
    this.selectedElement = elementId;
    
    const elementGroup = this.canvas.getRootGroup().querySelector(`[data-element-id="${elementId}"]`) as SVGElement;
    if (elementGroup) {
      // Add selection outline
      const element = this.elements.get(elementId);
      if (element) {
        const selectionRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        selectionRect.setAttribute('x', String(element.bounds.x - 5));
        selectionRect.setAttribute('y', String(element.bounds.y - 5));
        selectionRect.setAttribute('width', String(element.bounds.width + 10));
        selectionRect.setAttribute('height', String(element.bounds.height + 10));
        selectionRect.setAttribute('fill', 'none');
        selectionRect.setAttribute('stroke', '#1e88e5');
        selectionRect.setAttribute('stroke-width', '2');
        selectionRect.setAttribute('stroke-dasharray', '5,5');
        selectionRect.setAttribute('class', 'selection-outline');
        elementGroup.insertBefore(selectionRect, elementGroup.firstChild);
      }
    }
    
    this.eventBus.emit('element.selected', { elementId });
  }

  private clearSelection(): void {
    const selectionOutlines = this.canvas.getRootGroup().querySelectorAll('.selection-outline');
    selectionOutlines.forEach(outline => outline.remove());
    this.selectedElement = null;
    this.eventBus.emit('selection.cleared');
  }

  private updateConnectionsForElement(elementId: string, oldX: number, oldY: number): void {
    const element = this.elements.get(elementId);
    if (!element) return;

    const dx = element.bounds.x - oldX;
    const dy = element.bounds.y - oldY;

    this.connections.forEach(connection => {
      let updated = false;

      // Update waypoints if this element is the source
      if (connection.source === elementId) {
        // Update the first waypoint (connection start point)
        if (connection.waypoints.length > 0) {
          const sourcePoint = this.getConnectionPoint(element, connection.waypoints[1] || connection.waypoints[0], 'source');
          connection.waypoints[0] = sourcePoint;
          updated = true;
        }
      }

      // Update waypoints if this element is the target
      if (connection.target === elementId) {
        // Update the last waypoint (connection end point)
        if (connection.waypoints.length > 0) {
          const lastIndex = connection.waypoints.length - 1;
          const targetPoint = this.getConnectionPoint(element, connection.waypoints[lastIndex - 1] || connection.waypoints[lastIndex], 'target');
          connection.waypoints[lastIndex] = targetPoint;
          updated = true;
        }
      }

      // If connection only has 2 waypoints (direct connection), recalculate both
      if (updated && connection.waypoints.length === 2) {
        const source = this.elements.get(connection.source);
        const target = this.elements.get(connection.target);
        if (source && target) {
          connection.waypoints = this.calculateConnectionWaypoints(source, target);
        }
      }
    });
  }

  private getConnectionPoint(element: BPMNElement, referencePoint: Point, type: 'source' | 'target'): Point {
    // Calculate the connection point on the element's boundary
    const centerX = element.bounds.x + element.bounds.width / 2;
    const centerY = element.bounds.y + element.bounds.height / 2;

    // For circular elements (events)
    if (element.type.includes('Event')) {
      const radius = element.bounds.width / 2;
      const angle = Math.atan2(referencePoint.y - centerY, referencePoint.x - centerX);
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    }

    // For diamond shapes (gateways)
    if (element.type.includes('Gateway')) {
      const halfWidth = element.bounds.width / 2;
      const halfHeight = element.bounds.height / 2;
      
      // Calculate which side of the diamond to connect to
      const dx = referencePoint.x - centerX;
      const dy = referencePoint.y - centerY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      
      if (absDx / halfWidth > absDy / halfHeight) {
        // Connect to left or right point
        return {
          x: centerX + (dx > 0 ? halfWidth : -halfWidth),
          y: centerY
        };
      } else {
        // Connect to top or bottom point
        return {
          x: centerX,
          y: centerY + (dy > 0 ? halfHeight : -halfHeight)
        };
      }
    }

    // For rectangular elements (tasks)
    const points: Point[] = [
      { x: element.bounds.x + element.bounds.width / 2, y: element.bounds.y }, // top
      { x: element.bounds.x + element.bounds.width, y: element.bounds.y + element.bounds.height / 2 }, // right
      { x: element.bounds.x + element.bounds.width / 2, y: element.bounds.y + element.bounds.height }, // bottom
      { x: element.bounds.x, y: element.bounds.y + element.bounds.height / 2 } // left
    ];

    // Find the closest point
    let closestPoint = points[0];
    let minDistance = this.getDistance(points[0], referencePoint);

    for (let i = 1; i < points.length; i++) {
      const distance = this.getDistance(points[i], referencePoint);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = points[i];
      }
    }

    return closestPoint;
  }

  private calculateConnectionWaypoints(source: BPMNElement, target: BPMNElement): Point[] {
    const sourceCenterX = source.bounds.x + source.bounds.width / 2;
    const sourceCenterY = source.bounds.y + source.bounds.height / 2;
    const targetCenterX = target.bounds.x + target.bounds.width / 2;
    const targetCenterY = target.bounds.y + target.bounds.height / 2;

    const sourcePoint = this.getConnectionPoint(source, { x: targetCenterX, y: targetCenterY }, 'source');
    const targetPoint = this.getConnectionPoint(target, { x: sourceCenterX, y: sourceCenterY }, 'target');

    return [sourcePoint, targetPoint];
  }

  private getDistance(p1: Point, p2: Point): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  public addElement(element: BPMNElement): void {
    this.elements.set(element.id, element);
    this.render();
    this.eventBus.emit('element.added', { element });
  }

  public removeElement(elementId: string): void {
    if (this.elements.has(elementId)) {
      this.elements.delete(elementId);
      // Remove related connections
      this.connections.forEach((connection, id) => {
        if (connection.source === elementId || connection.target === elementId) {
          this.connections.delete(id);
        }
      });
      this.render();
      this.eventBus.emit('element.removed', { elementId });
    }
  }

  public addConnection(connection: Connection): void {
    this.connections.set(connection.id, connection);
    this.render();
    this.eventBus.emit('connection.added', { connection });
  }

  public removeConnection(connectionId: string): void {
    if (this.connections.has(connectionId)) {
      this.connections.delete(connectionId);
      this.render();
      this.eventBus.emit('connection.removed', { connectionId });
    }
  }

  private render(): void {
    this.canvas.clear();
    const rootGroup = this.canvas.getRootGroup();
    
    // Render connections first (so they appear behind elements)
    this.connections.forEach(connection => {
      this.renderConnection(connection, rootGroup);
    });
    
    // Render elements
    this.elements.forEach(element => {
      const renderer = this.renderers.get(element.type);
      if (renderer) {
        renderer.render(element, rootGroup);
      }
    });
    
    // Re-apply selection if needed
    if (this.selectedElement) {
      this.selectElement(this.selectedElement);
    }
  }

  private renderConnection(connection: Connection, container: SVGGElement): void {
    if (connection.waypoints.length < 2) return;
    
    let pathData = `M ${connection.waypoints[0].x} ${connection.waypoints[0].y}`;
    for (let i = 1; i < connection.waypoints.length; i++) {
      pathData += ` L ${connection.waypoints[i].x} ${connection.waypoints[i].y}`;
    }
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#000');
    path.setAttribute('stroke-width', '2');
    
    // Add arrow marker for sequence flows
    if (connection.type === 'sequenceFlow') {
      path.setAttribute('marker-end', 'url(#arrow-marker)');
    }
    
    container.appendChild(path);
  }

  public importXML(xml: string): Promise<void> {
    // This would use bpmn-moddle to parse the XML
    // For now, we'll create a simple demo
    return Promise.resolve();
  }

  public exportXML(): Promise<string> {
    // This would use bpmn-moddle to serialize to XML
    // For now, return a placeholder
    return Promise.resolve('<bpmn:definitions></bpmn:definitions>');
  }

  public getEventBus(): EventBus {
    return this.eventBus;
  }

  public getCanvas(): Canvas {
    return this.canvas;
  }

  public zoomIn(): void {
    this.canvas.setZoom(this.canvas.getZoom() * 1.2);
  }

  public zoomOut(): void {
    this.canvas.setZoom(this.canvas.getZoom() / 1.2);
  }

  public fitToViewport(): void {
    // Calculate bounds of all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    this.elements.forEach(element => {
      minX = Math.min(minX, element.bounds.x);
      minY = Math.min(minY, element.bounds.y);
      maxX = Math.max(maxX, element.bounds.x + element.bounds.width);
      maxY = Math.max(maxY, element.bounds.y + element.bounds.height);
    });
    
    if (minX !== Infinity) {
      this.canvas.centerView({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      });
    }
  }

  public destroy(): void {
    this.canvas.destroy();
    this.eventBus.clear();
  }
}
