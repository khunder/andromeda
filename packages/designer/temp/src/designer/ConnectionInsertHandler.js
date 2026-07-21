"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionInsertHandler = void 0;
class ConnectionInsertHandler {
    constructor(svg, elementManager, connectionManager, onInsert) {
        this.svg = svg;
        this.elementManager = elementManager;
        this.connectionManager = connectionManager;
        this.onInsert = onInsert;
        this.highlightedConnection = null;
        this.highlightElement = null;
        this.isDraggingOverConnection = false;
    }
    /**
     * Check if a point is near a connection line
     */
    checkConnectionProximity(point, elementType) {
        const connections = this.connectionManager.getAllConnections();
        const threshold = 15; // Distance threshold in pixels
        for (const connection of connections) {
            if (connection.waypoints.length < 2)
                continue;
            // Check distance to each segment
            for (let i = 0; i < connection.waypoints.length - 1; i++) {
                const distance = this.pointToSegmentDistance(point, connection.waypoints[i], connection.waypoints[i + 1]);
                if (distance < threshold) {
                    // Check if this element type can be inserted here
                    const source = this.elementManager.getElement(connection.source);
                    const target = this.elementManager.getElement(connection.target);
                    if (source && target && this.canInsertBetween(source, elementType, target)) {
                        return connection.id;
                    }
                }
            }
        }
        return null;
    }
    /**
     * Check if an element type can be inserted between two elements
     */
    canInsertBetween(source, elementType, target) {
        // Tasks can be inserted between most elements
        if (elementType.includes('Task')) {
            // Can't insert after end event or before start event
            if (source.type === 'endEvent' || target.type === 'startEvent') {
                return false;
            }
            return true;
        }
        // Gateways can be inserted between tasks and other gateways
        if (elementType.includes('Gateway')) {
            if (source.type === 'endEvent' || target.type === 'startEvent') {
                return false;
            }
            return true;
        }
        // Events generally shouldn't be inserted
        if (elementType.includes('Event')) {
            return false;
        }
        return false;
    }
    /**
     * Highlight a connection when hovering over it
     */
    highlightConnection(connectionId) {
        if (this.highlightedConnection === connectionId)
            return;
        this.clearHighlight();
        this.highlightedConnection = connectionId;
        // Find the connection path element
        const pathGroup = this.svg.querySelector(`[data-connection-id="${connectionId}"]`);
        if (pathGroup) {
            // Create highlight overlay
            this.highlightElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            const connection = this.connectionManager.getConnection(connectionId);
            if (connection && connection.waypoints.length >= 2) {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const d = this.createPathData(connection.waypoints);
                path.setAttribute('d', d);
                path.setAttribute('stroke', '#4caf50');
                path.setAttribute('stroke-width', '4');
                path.setAttribute('fill', 'none');
                path.setAttribute('opacity', '0.5');
                path.style.pointerEvents = 'none';
                // Add pulsing animation
                const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
                animate.setAttribute('attributeName', 'stroke-width');
                animate.setAttribute('values', '4;6;4');
                animate.setAttribute('dur', '1s');
                animate.setAttribute('repeatCount', 'indefinite');
                path.appendChild(animate);
                this.highlightElement.appendChild(path);
                this.svg.appendChild(this.highlightElement);
            }
        }
        this.isDraggingOverConnection = true;
    }
    /**
     * Clear connection highlight
     */
    clearHighlight() {
        if (this.highlightElement) {
            this.highlightElement.remove();
            this.highlightElement = null;
        }
        this.highlightedConnection = null;
        this.isDraggingOverConnection = false;
    }
    /**
     * Insert a node on a connection
     */
    insertNodeOnConnection(connectionId, elementType, dropPoint) {
        const connection = this.connectionManager.getConnection(connectionId);
        if (!connection)
            return null;
        const source = this.elementManager.getElement(connection.source);
        const target = this.elementManager.getElement(connection.target);
        if (!source || !target)
            return null;
        // Calculate position for new element (at drop point)
        const elementWidth = elementType.includes('Event') ? 36 :
            elementType.includes('Gateway') ? 50 : 100;
        const elementHeight = elementType.includes('Event') ? 36 :
            elementType.includes('Gateway') ? 50 : 80;
        const x = dropPoint.x - elementWidth / 2;
        const y = dropPoint.y - elementHeight / 2;
        // Create new element
        const newElementId = this.elementManager.addElement(elementType, x, y);
        const newElement = this.elementManager.getElement(newElementId);
        if (!newElement)
            return null;
        // Delete old connection
        this.connectionManager.deleteConnection(connectionId);
        // Create two new connections
        const conn1Id = this.connectionManager.addConnection(connection.source, newElementId);
        const conn2Id = this.connectionManager.addConnection(newElementId, connection.target);
        // Update waypoints for new connections
        const conn1 = this.connectionManager.getConnection(conn1Id);
        const conn2 = this.connectionManager.getConnection(conn2Id);
        if (conn1 && source) {
            this.connectionManager.updateConnectionWaypoints(conn1, source, newElement);
        }
        if (conn2 && target) {
            this.connectionManager.updateConnectionWaypoints(conn2, newElement, target);
        }
        // Clear highlight
        this.clearHighlight();
        // Trigger update
        this.onInsert();
        return newElementId;
    }
    /**
     * Calculate distance from point to line segment
     */
    pointToSegmentDistance(point, start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const lengthSquared = dx * dx + dy * dy;
        if (lengthSquared === 0) {
            return Math.sqrt(Math.pow((point.x - start.x), 2) + Math.pow((point.y - start.y), 2));
        }
        const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
        const projection = {
            x: start.x + t * dx,
            y: start.y + t * dy
        };
        return Math.sqrt(Math.pow((point.x - projection.x), 2) + Math.pow((point.y - projection.y), 2));
    }
    /**
     * Create SVG path data from waypoints
     */
    createPathData(waypoints) {
        if (waypoints.length < 2)
            return '';
        let d = `M ${waypoints[0].x} ${waypoints[0].y}`;
        for (let i = 1; i < waypoints.length; i++) {
            d += ` L ${waypoints[i].x} ${waypoints[i].y}`;
        }
        return d;
    }
    /**
     * Check if currently dragging over a connection
     */
    isDraggingOver() {
        return this.isDraggingOverConnection;
    }
    /**
     * Get the highlighted connection ID
     */
    getHighlightedConnection() {
        return this.highlightedConnection;
    }
}
exports.ConnectionInsertHandler = ConnectionInsertHandler;
