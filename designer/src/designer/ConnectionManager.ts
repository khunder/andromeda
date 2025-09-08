import { Connection, Point, BPMNElement } from './types';

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

  updateConnectionWaypoints(connection: Connection, sourceElement: BPMNElement, targetElement: BPMNElement): void {
    const sourcePoint = this.getConnectionPoint(sourceElement, targetElement);
    const targetPoint = this.getConnectionPoint(targetElement, sourceElement);
    connection.waypoints = [sourcePoint, targetPoint];
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
