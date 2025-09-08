import { BPMNElement, Point, DragState, Connection } from './types';
import { ElementManager } from './ElementManager';
import { ConnectionManager } from './ConnectionManager';
import { Renderer } from './Renderer';

export class DragHandler {
  private dragState: DragState = {
    isDragging: false,
    element: null,
    offset: { x: 0, y: 0 },
    originalPosition: null,
    shadowGroup: null,
    shadowConnections: []
  };

  constructor(
    private elementManager: ElementManager,
    private connectionManager: ConnectionManager,
    private renderer: Renderer,
    private svg: SVGSVGElement,
    private onDragEnd: () => void
  ) {}

  startDrag(element: BPMNElement, mousePoint: Point): void {
    this.dragState.isDragging = true;
    this.dragState.element = element;
    this.dragState.offset = {
      x: mousePoint.x - element.x,
      y: mousePoint.y - element.y
    };
    this.dragState.originalPosition = { x: element.x, y: element.y };
    
    // Create shadow
    this.createDragShadow(element);
  }

  updateDrag(mousePoint: Point): void {
    if (!this.dragState.isDragging || !this.dragState.element) return;
    
    const newX = mousePoint.x - this.dragState.offset.x;
    const newY = mousePoint.y - this.dragState.offset.y;
    
    // Update element position
    this.elementManager.updateElement(this.dragState.element.id, {
      x: newX,
      y: newY
    });
    
    // Update connections
    this.updateConnectionsForElement(this.dragState.element.id);
  }

  endDrag(): void {
    if (this.dragState.isDragging) {
      this.removeDragShadow();
      this.dragState.isDragging = false;
      this.dragState.element = null;
      this.dragState.originalPosition = null;
      this.onDragEnd();
    }
  }

  isDragging(): boolean {
    return this.dragState.isDragging;
  }

  private createDragShadow(element: BPMNElement): void {
    if (!this.dragState.originalPosition) return;
    
    const shadowGroup = this.createSVGElement('g') as SVGGElement;
    shadowGroup.setAttribute('class', 'drag-shadow');
    shadowGroup.style.opacity = '0.3';
    shadowGroup.style.pointerEvents = 'none';
    
    // Create shadow element
    const shadowElement = { ...element, x: this.dragState.originalPosition.x, y: this.dragState.originalPosition.y };
    this.renderShadowElement(shadowElement, shadowGroup);
    
    // Create shadow connections
    this.dragState.shadowConnections = [];
    const connections = this.connectionManager.getConnectionsForElement(element.id);
    
    connections.forEach(connection => {
      const shadowPath = this.createShadowConnection(connection, element);
      if (shadowPath) {
        this.dragState.shadowConnections.push(shadowPath);
        this.renderer.getMainGroup().appendChild(shadowPath);
      }
    });
    
    this.dragState.shadowGroup = shadowGroup;
    this.renderer.getMainGroup().appendChild(shadowGroup);
  }

  private renderShadowElement(element: BPMNElement, group: SVGGElement): void {
    if (element.type.includes('Event')) {
      const circle = this.createSVGElement('circle');
      circle.setAttribute('cx', String(element.x + element.width / 2));
      circle.setAttribute('cy', String(element.y + element.height / 2));
      circle.setAttribute('r', String(element.width / 2));
      circle.setAttribute('fill', '#ccc');
      circle.setAttribute('stroke', '#666');
      circle.setAttribute('stroke-width', element.type === 'endEvent' ? '4' : '2');
      circle.setAttribute('stroke-dasharray', '5,5');
      group.appendChild(circle);
    } else if (element.type.includes('Gateway')) {
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      const points = `${cx},${element.y} ${element.x + element.width},${cy} ${cx},${element.y + element.height} ${element.x},${cy}`;
      const polygon = this.createSVGElement('polygon');
      polygon.setAttribute('points', points);
      polygon.setAttribute('fill', '#ccc');
      polygon.setAttribute('stroke', '#666');
      polygon.setAttribute('stroke-width', '2');
      polygon.setAttribute('stroke-dasharray', '5,5');
      group.appendChild(polygon);
    } else {
      const rect = this.createSVGElement('rect');
      rect.setAttribute('x', String(element.x));
      rect.setAttribute('y', String(element.y));
      rect.setAttribute('width', String(element.width));
      rect.setAttribute('height', String(element.height));
      rect.setAttribute('rx', '5');
      rect.setAttribute('fill', '#ccc');
      rect.setAttribute('stroke', '#666');
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('stroke-dasharray', '5,5');
      group.appendChild(rect);
    }
  }

  private createShadowConnection(connection: Connection, draggedElement: BPMNElement): SVGPathElement | null {
    const source = this.elementManager.getElement(connection.source);
    const target = this.elementManager.getElement(connection.target);
    
    if (!source || !target || !this.dragState.originalPosition) return null;
    
    // Calculate waypoints for shadow connection
    let shadowSource = source;
    let shadowTarget = target;
    
    if (connection.source === draggedElement.id) {
      shadowSource = { ...source, x: this.dragState.originalPosition.x, y: this.dragState.originalPosition.y };
    } else {
      shadowTarget = { ...target, x: this.dragState.originalPosition.x, y: this.dragState.originalPosition.y };
    }
    
    const sourcePoint = this.connectionManager.getConnectionPoint(shadowSource, shadowTarget);
    const targetPoint = this.connectionManager.getConnectionPoint(shadowTarget, shadowSource);
    
    // Create shadow connection path
    const path = this.createSVGElement('path') as SVGPathElement;
    path.setAttribute('d', `M ${sourcePoint.x} ${sourcePoint.y} L ${targetPoint.x} ${targetPoint.y}`);
    path.setAttribute('stroke', '#999');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-dasharray', '5,5');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrowhead)');
    path.style.opacity = '0.3';
    path.style.pointerEvents = 'none';
    
    return path;
  }

  private removeDragShadow(): void {
    if (this.dragState.shadowGroup) {
      this.dragState.shadowGroup.remove();
      this.dragState.shadowGroup = null;
    }
    
    this.dragState.shadowConnections.forEach(conn => conn.remove());
    this.dragState.shadowConnections = [];
  }

  private createSVGElement(type: string): SVGElement {
    return document.createElementNS('http://www.w3.org/2000/svg', type);
  }

  private updateConnectionsForElement(elementId: string): void {
    const connections = this.connectionManager.getConnectionsForElement(elementId);
    connections.forEach(connection => {
      const source = this.elementManager.getElement(connection.source);
      const target = this.elementManager.getElement(connection.target);
      if (source && target) {
        this.connectionManager.updateConnectionWaypoints(connection, source, target);
      }
    });
  }

  maintainShadow(): void {
    if (this.dragState.shadowGroup) {
      this.renderer.getMainGroup().appendChild(this.dragState.shadowGroup);
    }
    this.dragState.shadowConnections.forEach(conn => {
      this.renderer.getMainGroup().insertBefore(conn, this.dragState.shadowGroup);
    });
  }
}
