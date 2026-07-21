"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionManager = void 0;
class ConnectionManager {
    constructor() {
        this.connections = new Map();
        this.idCounter = 0;
    }
    addConnection(sourceId, targetId) {
        const id = `connection_${++this.idCounter}`;
        const connection = {
            id,
            source: sourceId,
            target: targetId,
            waypoints: []
        };
        this.connections.set(id, connection);
        return id;
    }
    getConnection(id) {
        return this.connections.get(id);
    }
    getAllConnections() {
        return Array.from(this.connections.values());
    }
    updateConnectionWaypoints(connection, sourceElement, targetElement) {
        const sourcePoint = this.getConnectionPoint(sourceElement, targetElement);
        const targetPoint = this.getConnectionPoint(targetElement, sourceElement);
        connection.waypoints = [sourcePoint, targetPoint];
    }
    getConnectionPoint(fromElement, toElement) {
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
    getDiamondEdgePoint(center, halfWidth, halfHeight, angle) {
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
        }
        else if (degrees >= 45 && degrees < 135) {
            // Bottom edge
            const t = 1 / Math.tan(angle);
            return {
                x: center.x + halfHeight * t,
                y: center.y + halfHeight
            };
        }
        else if (degrees >= 135 && degrees < 225) {
            // Left edge
            const t = Math.tan(angle);
            return {
                x: center.x - halfWidth,
                y: center.y - halfWidth * t
            };
        }
        else {
            // Top edge
            const t = 1 / Math.tan(angle);
            return {
                x: center.x - halfHeight * t,
                y: center.y - halfHeight
            };
        }
    }
    getRectangleEdgePoint(rect, targetPoint) {
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
    getDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    getConnectionsForElement(elementId) {
        return this.getAllConnections().filter(conn => conn.source === elementId || conn.target === elementId);
    }
    deleteConnectionsForElement(elementId) {
        const toDelete = [];
        this.connections.forEach((connection, id) => {
            if (connection.source === elementId || connection.target === elementId) {
                toDelete.push(id);
            }
        });
        toDelete.forEach(id => this.connections.delete(id));
    }
    deleteConnection(id) {
        this.connections.delete(id);
    }
    clear() {
        this.connections.clear();
        this.idCounter = 0;
    }
    getConnectionsMap() {
        return this.connections;
    }
}
exports.ConnectionManager = ConnectionManager;
