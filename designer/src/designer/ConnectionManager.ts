import { Connection, Point, BPMNElement } from './types';

/**
 * Manages connections (edges) between BPMN elements
 * Computes optimal waypoints and connection points based on element shapes
 */
export class ConnectionManager {
  private connections: Map<string, Connection> = new Map();
  private idCounter = 0;

  addConnection(sourceId: string, targetId: string): string {
    const id = `connection_${++this.idCounter}`;
    const connection: Connection = {
      id,
      source: sourceId,
      target: targetId,
      waypoints: []
    };
    
    this.connections.set(id, connection);
    return id;
  }

  getConnection(id: string): Connection | undefined {
    return this.connections.get(id);
  }

  getAllConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Compute waypoints for a connection between two elements
   * - Straight line when elements are aligned horizontally or vertically
   * - L-shaped path with rounded corners for diagonal placements
   */
  updateConnectionWaypoints(connection: Connection, sourceElement: BPMNElement, targetElement: BPMNElement): void {
    const sourcePoint = this.getConnectionPoint(sourceElement, targetElement);
    const targetPoint = this.getConnectionPoint(targetElement, sourceElement);
    
    // Check if elements are perfectly aligned (keep it straight)
    const sourceCenterX = sourceElement.x + sourceElement.width / 2;
    const sourceCenterY = sourceElement.y + sourceElement.height / 2;
    const targetCenterX = targetElement.x + targetElement.width / 2;
    const targetCenterY = targetElement.y + targetElement.height / 2;
    
    const alignmentThreshold = 5; // pixels
    const isHorizontallyAligned = Math.abs(sourceCenterY - targetCenterY) < alignmentThreshold;
    const isVerticallyAligned = Math.abs(sourceCenterX - targetCenterX) < alignmentThreshold;
    
    // If perfectly aligned, use straight connection
    if (isHorizontallyAligned || isVerticallyAligned) {
      connection.waypoints = [sourcePoint, targetPoint];
      return;
    }
    
    // Calculate angle between elements
    const angle = Math.abs(Math.atan2(
      targetPoint.y - sourcePoint.y,
      targetPoint.x - sourcePoint.x
    ) * 180 / Math.PI);
    
    // If angle is more than 45 degrees from horizontal/vertical, create L-shaped connection
    if ((angle > 45 && angle < 135) || (angle > 225 && angle < 315)) {
      const waypoints = this.createLShapedConnection(sourceElement, targetElement, sourcePoint, targetPoint);
      connection.waypoints = waypoints;
    } else {
      connection.waypoints = [sourcePoint, targetPoint];
    }
  }

  getConnectionPoint(fromElement: BPMNElement, toElement: BPMNElement): Point {
    const fromCenter = {
      x: fromElement.x + fromElement.width / 2,
      y: fromElement.y + fromElement.height / 2
    };
    const toCenter = {
      x: toElement.x + toElement.width / 2,
      y: toElement.y + toElement.height / 2
    };

    // Calculate the angle from source to target
    const angle = Math.atan2(toCenter.y - fromCenter.y, toCenter.x - fromCenter.x);

    // For circles (events) - get point on circumference
    if (fromElement.type.includes('Event')) {
      const radius = fromElement.width / 2;
      return {
        x: fromCenter.x + radius * Math.cos(angle),
        y: fromCenter.y + radius * Math.sin(angle)
      };
    }

    // For diamonds (gateways) - get point on diamond edge
    if (fromElement.type.includes('Gateway')) {
      return this.getDiamondEdgePoint(fromCenter, fromElement.width / 2, fromElement.height / 2, angle);
    }

    // For rectangles (tasks) - get intersection point with rectangle edge
    return this.getRectangleEdgePoint(fromElement, toCenter);
  }

  private getDiamondEdgePoint(center: Point, halfWidth: number, halfHeight: number, angle: number): Point {
    // Convert angle to 0-360 range
    const degrees = ((angle * 180 / Math.PI) + 360) % 360;
    
    // Determine which edge of the diamond
    if (degrees >= 315 || degrees < 45) {
      // Right edge
      const t = Math.tan(angle);
      return {
        x: center.x + halfWidth,
        y: center.y + halfWidth * t
      };
    } else if (degrees >= 45 && degrees < 135) {
      // Bottom edge
      const t = 1 / Math.tan(angle);
      return {
        x: center.x + halfHeight * t,
        y: center.y + halfHeight
      };
    } else if (degrees >= 135 && degrees < 225) {
      // Left edge
      const t = Math.tan(angle);
      return {
        x: center.x - halfWidth,
        y: center.y - halfWidth * t
      };
    } else {
      // Top edge
      const t = 1 / Math.tan(angle);
      return {
        x: center.x - halfHeight * t,
        y: center.y - halfHeight
      };
    }
  }

  private getRectangleEdgePoint(rect: BPMNElement, targetPoint: Point): Point {
    const center = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2
    };
    
    // Calculate intersection with rectangle edges
    const dx = targetPoint.x - center.x;
    const dy = targetPoint.y - center.y;
    
    if (dx === 0 && dy === 0) {
      return center;
    }
    
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    
    const halfWidth = rect.width / 2;
    const halfHeight = rect.height / 2;
    
    // Calculate scale factor to reach the edge
    const scaleX = halfWidth / absDx;
    const scaleY = halfHeight / absDy;
    const scale = Math.min(scaleX, scaleY);
    
    return {
      x: center.x + dx * scale,
      y: center.y + dy * scale
    };
  }

  private getDistance(p1: Point, p2: Point): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * Create an L-shaped connection (HV or VH) between two elements
   * Places a mid-segment half-way and chooses optimal exit/entry sides
   */
  private createLShapedConnection(
    sourceElement: BPMNElement,
    targetElement: BPMNElement,
    sourcePoint: Point,
    targetPoint: Point
  ): Point[] {
    const sourceCenterX = sourceElement.x + sourceElement.width / 2;
    const sourceCenterY = sourceElement.y + sourceElement.height / 2;
    const targetCenterX = targetElement.x + targetElement.width / 2;
    const targetCenterY = targetElement.y + targetElement.height / 2;
    
    // Determine the best L-shape routing
    const dx = targetCenterX - sourceCenterX;
    const dy = targetCenterY - sourceCenterY;
    
    // Get optimal connection points for L-shape
    let optimalSourcePoint: Point;
    let optimalTargetPoint: Point;
    let middlePoints: Point[] = [];
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal dominant - connect from sides
      if (dx > 0) {
        // Target is to the right
        optimalSourcePoint = this.getEdgePoint(sourceElement, 'right');
        optimalTargetPoint = this.getEdgePoint(targetElement, 'left');
        
        // Create middle waypoint
        const middleX = (optimalSourcePoint.x + optimalTargetPoint.x) / 2;
        middlePoints = [
          { x: middleX, y: optimalSourcePoint.y },
          { x: middleX, y: optimalTargetPoint.y }
        ];
      } else {
        // Target is to the left
        optimalSourcePoint = this.getEdgePoint(sourceElement, 'left');
        optimalTargetPoint = this.getEdgePoint(targetElement, 'right');
        
        const middleX = (optimalSourcePoint.x + optimalTargetPoint.x) / 2;
        middlePoints = [
          { x: middleX, y: optimalSourcePoint.y },
          { x: middleX, y: optimalTargetPoint.y }
        ];
      }
    } else {
      // Vertical dominant - connect from top/bottom
      if (dy > 0) {
        // Target is below
        optimalSourcePoint = this.getEdgePoint(sourceElement, 'bottom');
        optimalTargetPoint = this.getEdgePoint(targetElement, 'top');
        
        const middleY = (optimalSourcePoint.y + optimalTargetPoint.y) / 2;
        middlePoints = [
          { x: optimalSourcePoint.x, y: middleY },
          { x: optimalTargetPoint.x, y: middleY }
        ];
      } else {
        // Target is above
        optimalSourcePoint = this.getEdgePoint(sourceElement, 'top');
        optimalTargetPoint = this.getEdgePoint(targetElement, 'bottom');
        
        const middleY = (optimalSourcePoint.y + optimalTargetPoint.y) / 2;
        middlePoints = [
          { x: optimalSourcePoint.x, y: middleY },
          { x: optimalTargetPoint.x, y: middleY }
        ];
      }
    }
    
    return [optimalSourcePoint, ...middlePoints, optimalTargetPoint];
  }
  
  /**
   * Returns the center point on the requested edge of a rectangular element
   */
  private getEdgePoint(element: BPMNElement, side: 'top' | 'right' | 'bottom' | 'left'): Point {
    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;
    
    switch (side) {
      case 'top':
        return { x: centerX, y: element.y };
      case 'right':
        return { x: element.x + element.width, y: centerY };
      case 'bottom':
        return { x: centerX, y: element.y + element.height };
      case 'left':
        return { x: element.x, y: centerY };
      default:
        return { x: centerX, y: centerY };
    }
  }

  getConnectionsForElement(elementId: string): Connection[] {
    return this.getAllConnections().filter(
      conn => conn.source === elementId || conn.target === elementId
    );
  }

  deleteConnectionsForElement(elementId: string): void {
    const toDelete: string[] = [];
    this.connections.forEach((connection, id) => {
      if (connection.source === elementId || connection.target === elementId) {
        toDelete.push(id);
      }
    });
    toDelete.forEach(id => this.connections.delete(id));
  }

  deleteConnection(id: string): void {
    this.connections.delete(id);
  }

  clear(): void {
    this.connections.clear();
    this.idCounter = 0;
  }

  getConnectionsMap(): Map<string, Connection> {
    return this.connections;
  }
}
