import { Connection, Point } from './types';
import { ConnectionManager } from './ConnectionManager';
import { ElementManager } from './ElementManager';

export class ConnectionEditor {
  private selectedConnectionId: string | null = null;
  private waypointHandles: SVGCircleElement[] = [];
  private isDraggingWaypoint = false;
  private draggedWaypointIndex = -1;
  
  constructor(
    private svg: SVGSVGElement,
    private connectionManager: ConnectionManager,
    private elementManager: ElementManager,
    private onConnectionUpdate: () => void
  ) {}
  
  selectConnection(connectionId: string): void {
    this.clearSelection();
    this.selectedConnectionId = connectionId;
    const connection = this.connectionManager.getConnection(connectionId);
    
    if (connection) {
      this.showWaypoints(connection);
      this.highlightConnection(connectionId);
    }
  }
  
  clearSelection(): void {
    this.selectedConnectionId = null;
    this.clearWaypoints();
    this.clearHighlight();
  }
  
  getSelectedConnection(): string | null {
    return this.selectedConnectionId;
  }
  
  updateWaypointHandles(connection: Connection): void {
    // Clear existing handles
    this.clearWaypoints();
    
    // Recreate handles with updated positions
    if (connection && this.selectedConnectionId === connection.id) {
      this.showWaypoints(connection);
    }
  }
  
  private showWaypoints(connection: Connection): void {
    this.clearWaypoints();
    
    connection.waypoints.forEach((waypoint, index) => {
      const handle = this.createWaypointHandle(waypoint, index);
      this.waypointHandles.push(handle);
      this.svg.appendChild(handle);
    });
  }
  
  private createWaypointHandle(point: Point, index: number): SVGCircleElement {
    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    handle.setAttribute('cx', String(point.x));
    handle.setAttribute('cy', String(point.y));
    handle.setAttribute('r', '6');
    handle.setAttribute('fill', '#1e88e5');
    handle.setAttribute('stroke', '#fff');
    handle.setAttribute('stroke-width', '2');
    handle.setAttribute('cursor', 'move');
    handle.setAttribute('data-waypoint-index', String(index));
    handle.style.zIndex = '1000';
    
    // Add drag functionality
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.startDraggingWaypoint(index, e);
    });
    
    return handle;
  }
  
  private startDraggingWaypoint(index: number, e: MouseEvent): void {
    this.isDraggingWaypoint = true;
    this.draggedWaypointIndex = index;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (this.isDraggingWaypoint && this.selectedConnectionId) {
        const pt = this.getSVGPoint(e);
        this.updateWaypoint(this.selectedConnectionId, this.draggedWaypointIndex, pt);
      }
    };
    
    const handleMouseUp = () => {
      this.isDraggingWaypoint = false;
      this.draggedWaypointIndex = -1;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }
  
  private updateWaypoint(connectionId: string, index: number, newPoint: Point): void {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) return;
    
    // For endpoints, snap to element edge
    if (index === 0) {
      // Update source endpoint
      const targetElement = this.findElementAtPoint(newPoint);
      if (targetElement) {
        connection.source = targetElement.id;
        const target = this.elementManager.getElement(connection.target);
        if (target) {
          this.connectionManager.updateConnectionWaypoints(connection, targetElement, target);
        }
      }
    } else if (index === connection.waypoints.length - 1) {
      // Update target endpoint
      const targetElement = this.findElementAtPoint(newPoint);
      if (targetElement) {
        connection.target = targetElement.id;
        const source = this.elementManager.getElement(connection.source);
        if (source) {
          this.connectionManager.updateConnectionWaypoints(connection, source, targetElement);
        }
      }
    } else {
      // Update intermediate waypoint
      connection.waypoints[index] = newPoint;
    }
    
    // Update handle position
    if (this.waypointHandles[index]) {
      this.waypointHandles[index].setAttribute('cx', String(newPoint.x));
      this.waypointHandles[index].setAttribute('cy', String(newPoint.y));
    }
    
    this.onConnectionUpdate();
  }
  
  private findElementAtPoint(point: Point): any {
    const elements = this.elementManager.getAllElements();
    for (const element of elements) {
      if (point.x >= element.x && 
          point.x <= element.x + element.width &&
          point.y >= element.y && 
          point.y <= element.y + element.height) {
        return element;
      }
    }
    return null;
  }
  
  private highlightConnection(connectionId: string): void {
    const pathElement = this.svg.querySelector(`[data-connection-id="${connectionId}"]`) as SVGPathElement;
    if (pathElement) {
      pathElement.setAttribute('stroke', '#1e88e5');
      pathElement.setAttribute('stroke-width', '3');
    }
  }
  
  private clearHighlight(): void {
    if (this.selectedConnectionId) {
      const pathElement = this.svg.querySelector(`[data-connection-id="${this.selectedConnectionId}"]`) as SVGPathElement;
      if (pathElement) {
        pathElement.setAttribute('stroke', '#333');
        pathElement.setAttribute('stroke-width', '2');
      }
    }
  }
  
  private clearWaypoints(): void {
    this.waypointHandles.forEach(handle => handle.remove());
    this.waypointHandles = [];
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
  
  addWaypoint(connectionId: string, point: Point): void {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) return;
    
    // Find the closest segment and insert waypoint
    let closestSegment = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < connection.waypoints.length - 1; i++) {
      const distance = this.pointToSegmentDistance(
        point,
        connection.waypoints[i],
        connection.waypoints[i + 1]
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestSegment = i;
      }
    }
    
    // Insert new waypoint
    connection.waypoints.splice(closestSegment + 1, 0, point);
    this.onConnectionUpdate();
    
    // Re-select to show new waypoints
    this.selectConnection(connectionId);
  }
  
  removeWaypoint(connectionId: string, index: number): void {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) return;
    
    // Don't remove endpoints
    if (index === 0 || index === connection.waypoints.length - 1) return;
    
    connection.waypoints.splice(index, 1);
    this.onConnectionUpdate();
    
    // Re-select to show updated waypoints
    this.selectConnection(connectionId);
  }
  
  private pointToSegmentDistance(point: Point, start: Point, end: Point): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
      return Math.sqrt((point.x - start.x) ** 2 + (point.y - start.y) ** 2);
    }
    
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    const projection = {
      x: start.x + t * dx,
      y: start.y + t * dy
    };
    
    return Math.sqrt((point.x - projection.x) ** 2 + (point.y - projection.y) ** 2);
  }
  
  getSelectedConnectionId(): string | null {
    return this.selectedConnectionId;
  }
}
