"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DragHandler = void 0;
class DragHandler {
    constructor(elementManager, connectionManager, renderer, svg, onDragEnd) {
        this.elementManager = elementManager;
        this.connectionManager = connectionManager;
        this.renderer = renderer;
        this.svg = svg;
        this.onDragEnd = onDragEnd;
        this.dragState = {
            isDragging: false,
            element: null,
            offset: { x: 0, y: 0 },
            originalPosition: null,
            shadowGroup: null,
            shadowConnections: []
        };
    }
    startDrag(element, mousePoint) {
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
    updateDrag(mousePoint) {
        if (!this.dragState.isDragging || !this.dragState.element)
            return;
        let newX = mousePoint.x - this.dragState.offset.x;
        let newY = mousePoint.y - this.dragState.offset.y;
        // Check for overlaps with other elements
        const collision = this.checkCollision(this.dragState.element.id, newX, newY, this.dragState.element.width, this.dragState.element.height);
        if (collision) {
            // Snap to nearest non-overlapping position
            const snapPosition = this.findNonOverlappingPosition(this.dragState.element, newX, newY, collision);
            newX = snapPosition.x;
            newY = snapPosition.y;
        }
        // Update element position
        this.elementManager.updateElement(this.dragState.element.id, {
            x: newX,
            y: newY
        });
        // Update connections
        this.updateConnectionsForElement(this.dragState.element.id);
    }
    endDrag() {
        if (this.dragState.isDragging) {
            this.removeDragShadow();
            this.dragState.isDragging = false;
            this.dragState.element = null;
            this.dragState.originalPosition = null;
            this.onDragEnd();
        }
    }
    isDragging() {
        return this.dragState.isDragging;
    }
    createDragShadow(element) {
        if (!this.dragState.originalPosition)
            return;
        const shadowGroup = this.createSVGElement('g');
        shadowGroup.setAttribute('class', 'drag-shadow');
        shadowGroup.style.opacity = '0.5';
        shadowGroup.style.pointerEvents = 'none';
        // Create shadow element
        const shadowElement = Object.assign(Object.assign({}, element), { x: this.dragState.originalPosition.x, y: this.dragState.originalPosition.y });
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
    renderShadowElement(element, group) {
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
        }
        else if (element.type.includes('Gateway')) {
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
        }
        else {
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
    createShadowConnection(connection, draggedElement) {
        const source = this.elementManager.getElement(connection.source);
        const target = this.elementManager.getElement(connection.target);
        if (!source || !target || !this.dragState.originalPosition)
            return null;
        // Calculate waypoints for shadow connection
        let shadowSource = source;
        let shadowTarget = target;
        if (connection.source === draggedElement.id) {
            shadowSource = Object.assign(Object.assign({}, source), { x: this.dragState.originalPosition.x, y: this.dragState.originalPosition.y });
        }
        else {
            shadowTarget = Object.assign(Object.assign({}, target), { x: this.dragState.originalPosition.x, y: this.dragState.originalPosition.y });
        }
        const sourcePoint = this.connectionManager.getConnectionPoint(shadowSource, shadowTarget);
        const targetPoint = this.connectionManager.getConnectionPoint(shadowTarget, shadowSource);
        // Create shadow connection path
        const path = this.createSVGElement('path');
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
    removeDragShadow() {
        if (this.dragState.shadowGroup) {
            this.dragState.shadowGroup.remove();
            this.dragState.shadowGroup = null;
        }
        this.dragState.shadowConnections.forEach(conn => conn.remove());
        this.dragState.shadowConnections = [];
    }
    createSVGElement(type) {
        return document.createElementNS('http://www.w3.org/2000/svg', type);
    }
    updateConnectionsForElement(elementId) {
        const connections = this.connectionManager.getConnectionsForElement(elementId);
        connections.forEach(connection => {
            const source = this.elementManager.getElement(connection.source);
            const target = this.elementManager.getElement(connection.target);
            if (source && target) {
                this.connectionManager.updateConnectionWaypoints(connection, source, target);
            }
        });
    }
    maintainShadow() {
        if (this.dragState.shadowGroup) {
            this.renderer.getMainGroup().appendChild(this.dragState.shadowGroup);
        }
        this.dragState.shadowConnections.forEach(conn => {
            this.renderer.getMainGroup().insertBefore(conn, this.dragState.shadowGroup);
        });
    }
    checkCollision(draggedId, x, y, width, height) {
        const elements = this.elementManager.getAllElements();
        for (const element of elements) {
            if (element.id === draggedId)
                continue;
            // Check if rectangles overlap
            if (x < element.x + element.width &&
                x + width > element.x &&
                y < element.y + element.height &&
                y + height > element.y) {
                return element;
            }
        }
        return null;
    }
    findNonOverlappingPosition(draggedElement, targetX, targetY, collidingElement) {
        // Calculate push direction based on centers
        const draggedCenterX = targetX + draggedElement.width / 2;
        const draggedCenterY = targetY + draggedElement.height / 2;
        const collidingCenterX = collidingElement.x + collidingElement.width / 2;
        const collidingCenterY = collidingElement.y + collidingElement.height / 2;
        const dx = draggedCenterX - collidingCenterX;
        const dy = draggedCenterY - collidingCenterY;
        // Snap to edge with minimum spacing
        const spacing = 10;
        let snapX = targetX;
        let snapY = targetY;
        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal snap
            if (dx > 0) {
                snapX = collidingElement.x + collidingElement.width + spacing;
            }
            else {
                snapX = collidingElement.x - draggedElement.width - spacing;
            }
        }
        else {
            // Vertical snap
            if (dy > 0) {
                snapY = collidingElement.y + collidingElement.height + spacing;
            }
            else {
                snapY = collidingElement.y - draggedElement.height - spacing;
            }
        }
        return { x: snapX, y: snapY };
    }
}
exports.DragHandler = DragHandler;
