"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Renderer = void 0;
class Renderer {
    constructor(svg) {
        this.svg = svg;
        this.mainGroup = this.createSVGElement('g');
        this.svg.appendChild(this.mainGroup);
        this.defs = this.createSVGElement('defs');
        this.svg.appendChild(this.defs);
        this.createMarkers();
    }
    createSVGElement(type) {
        return document.createElementNS('http://www.w3.org/2000/svg', type);
    }
    createMarkers() {
        const marker = this.createSVGElement('marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '4');
        marker.setAttribute('markerHeight', '4');
        marker.setAttribute('refX', '4');
        marker.setAttribute('refY', '2');
        marker.setAttribute('orient', 'auto');
        const polygon = this.createSVGElement('polygon');
        polygon.setAttribute('points', '0 0, 4 2, 0 4');
        polygon.setAttribute('fill', '#333');
        marker.appendChild(polygon);
        this.defs.appendChild(marker);
    }
    clear() {
        while (this.mainGroup.firstChild) {
            this.mainGroup.removeChild(this.mainGroup.firstChild);
        }
    }
    renderElement(element) {
        const group = this.createSVGElement('g');
        group.setAttribute('data-element-id', element.id);
        group.style.cursor = 'move';
        if (element.type.includes('Event')) {
            this.renderEvent(element, group);
        }
        else if (element.type.includes('Gateway')) {
            this.renderGateway(element, group);
        }
        else {
            this.renderTask(element, group);
        }
        // Add label with custom positioning
        if (element.label) {
            this.renderLabel(element, group);
        }
        this.mainGroup.appendChild(group);
        return group;
    }
    renderLabel(element, group) {
        var _a;
        const labelPos = ((_a = element.properties) === null || _a === void 0 ? void 0 : _a.labelPosition) || {};
        const position = labelPos.position || 'center';
        const offset = labelPos.offset || { x: 0, y: 0 };
        let x = element.x + element.width / 2;
        let y = element.y + element.height / 2;
        let anchor = 'middle';
        let baseline = 'middle';
        switch (position) {
            case 'top':
                y = element.y - 5;
                baseline = 'bottom';
                break;
            case 'bottom':
                y = element.y + element.height + 15;
                baseline = 'top';
                break;
            case 'left':
                x = element.x - 5;
                anchor = 'end';
                break;
            case 'right':
                x = element.x + element.width + 5;
                anchor = 'start';
                break;
            case 'center':
            default:
                // Already set
                break;
        }
        // Apply offset
        x += offset.x;
        y += offset.y;
        const text = this.createSVGElement('text');
        text.setAttribute('x', String(x));
        text.setAttribute('y', String(y));
        text.setAttribute('text-anchor', anchor);
        text.setAttribute('dominant-baseline', baseline);
        text.setAttribute('font-size', '12');
        text.setAttribute('font-family', 'Arial, sans-serif');
        text.setAttribute('fill', '#333');
        text.textContent = element.label;
        group.appendChild(text);
    }
    renderEvent(element, group) {
        var _a;
        const style = ((_a = element.properties) === null || _a === void 0 ? void 0 : _a.style) || {};
        const circle = this.createSVGElement('circle');
        circle.setAttribute('cx', String(element.x + element.width / 2));
        circle.setAttribute('cy', String(element.y + element.height / 2));
        circle.setAttribute('r', String(element.width / 2));
        circle.setAttribute('fill', style.fill || '#fff');
        circle.setAttribute('stroke', style.stroke || (element.type === 'endEvent' ? '#f44336' : '#4caf50'));
        circle.setAttribute('stroke-width', String(style.strokeWidth || (element.type === 'endEvent' ? 4 : 2)));
        group.appendChild(circle);
    }
    renderGateway(element, group) {
        var _a;
        const style = ((_a = element.properties) === null || _a === void 0 ? void 0 : _a.style) || {};
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;
        const points = `${cx},${element.y} ${element.x + element.width},${cy} ${cx},${element.y + element.height} ${element.x},${cy}`;
        const polygon = this.createSVGElement('polygon');
        polygon.setAttribute('points', points);
        polygon.setAttribute('fill', style.fill || '#fff8e1');
        polygon.setAttribute('stroke', style.stroke || '#ffa000');
        polygon.setAttribute('stroke-width', String(style.strokeWidth || 2));
        group.appendChild(polygon);
        // Add gateway icon
        if (element.type === 'exclusiveGateway') {
            const path = this.createSVGElement('path');
            const size = element.width * 0.3;
            path.setAttribute('d', `M ${cx - size} ${cy - size} L ${cx + size} ${cy + size} M ${cx - size} ${cy + size} L ${cx + size} ${cy - size}`);
            path.setAttribute('stroke', '#000');
            path.setAttribute('stroke-width', '3');
            path.setAttribute('fill', 'none');
            group.appendChild(path);
        }
        else if (element.type === 'parallelGateway') {
            const path = this.createSVGElement('path');
            const size = element.width * 0.3;
            path.setAttribute('d', `M ${cx} ${cy - size} L ${cx} ${cy + size} M ${cx - size} ${cy} L ${cx + size} ${cy}`);
            path.setAttribute('stroke', '#000');
            path.setAttribute('stroke-width', '3');
            path.setAttribute('fill', 'none');
            group.appendChild(path);
        }
    }
    renderTask(element, group) {
        var _a;
        const style = ((_a = element.properties) === null || _a === void 0 ? void 0 : _a.style) || {};
        const rect = this.createSVGElement('rect');
        rect.setAttribute('x', String(element.x));
        rect.setAttribute('y', String(element.y));
        rect.setAttribute('width', String(element.width));
        rect.setAttribute('height', String(element.height));
        rect.setAttribute('rx', String(style.borderRadius || 5));
        rect.setAttribute('fill', style.fill || '#e3f2fd');
        rect.setAttribute('stroke', style.stroke || '#1976d2');
        rect.setAttribute('stroke-width', String(style.strokeWidth || 2));
        group.appendChild(rect);
        // Add icon for specific task types
        if (element.type === 'userTask') {
            const icon = this.createSVGElement('circle');
            icon.setAttribute('cx', String(element.x + 15));
            icon.setAttribute('cy', String(element.y + 15));
            icon.setAttribute('r', '5');
            icon.setAttribute('fill', 'none');
            icon.setAttribute('stroke', '#666');
            icon.setAttribute('stroke-width', '1');
            group.appendChild(icon);
            const body = this.createSVGElement('path');
            body.setAttribute('d', `M ${element.x + 10} ${element.y + 22} Q ${element.x + 15} ${element.y + 20} ${element.x + 20} ${element.y + 22}`);
            body.setAttribute('stroke', '#666');
            body.setAttribute('stroke-width', '1');
            body.setAttribute('fill', 'none');
            group.appendChild(body);
        }
    }
    renderConnection(connection) {
        const group = this.createSVGElement('g');
        group.setAttribute('data-connection-id', connection.id);
        if (connection.waypoints.length >= 2) {
            const d = this.createPathData(connection.waypoints);
            // Create invisible wider path for easier clicking
            const clickPath = this.createSVGElement('path');
            clickPath.setAttribute('d', d);
            clickPath.setAttribute('stroke', 'transparent');
            clickPath.setAttribute('stroke-width', '10');
            clickPath.setAttribute('fill', 'none');
            clickPath.setAttribute('style', 'cursor: pointer;');
            clickPath.setAttribute('data-connection-id', connection.id);
            group.appendChild(clickPath);
            // Create visible path
            const path = this.createSVGElement('path');
            path.setAttribute('d', d);
            path.setAttribute('stroke', '#333');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');
            path.setAttribute('marker-end', 'url(#arrowhead)');
            path.setAttribute('style', 'pointer-events: none;');
            path.setAttribute('data-connection-id', connection.id);
            group.appendChild(path);
            // Add label if exists
            if (connection.label) {
                const midpoint = this.getMidpoint(connection.waypoints);
                const text = this.createSVGElement('text');
                text.setAttribute('x', String(midpoint.x));
                text.setAttribute('y', String(midpoint.y - 5));
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '12');
                text.setAttribute('font-family', 'Arial, sans-serif');
                text.setAttribute('fill', '#666');
                text.textContent = connection.label;
                group.appendChild(text);
            }
            this.mainGroup.insertBefore(group, this.mainGroup.firstChild);
            return path;
        }
        return this.createSVGElement('path');
    }
    getMidpoint(waypoints) {
        if (waypoints.length === 2) {
            return {
                x: (waypoints[0].x + waypoints[1].x) / 2,
                y: (waypoints[0].y + waypoints[1].y) / 2
            };
        }
        // For multiple waypoints, get the middle segment
        const midIndex = Math.floor(waypoints.length / 2);
        return waypoints[midIndex];
    }
    createPathData(waypoints) {
        if (waypoints.length < 2)
            return '';
        let d = `M ${waypoints[0].x} ${waypoints[0].y}`;
        for (let i = 1; i < waypoints.length; i++) {
            d += ` L ${waypoints[i].x} ${waypoints[i].y}`;
        }
        return d;
    }
    renderSelection(element) {
        const selection = this.createSVGElement('rect');
        selection.setAttribute('x', String(element.x - 5));
        selection.setAttribute('y', String(element.y - 5));
        selection.setAttribute('width', String(element.width + 10));
        selection.setAttribute('height', String(element.height + 10));
        selection.setAttribute('fill', 'none');
        selection.setAttribute('stroke', '#1e88e5');
        selection.setAttribute('stroke-width', '2');
        selection.setAttribute('stroke-dasharray', '5,5');
        selection.setAttribute('class', 'selection');
        selection.setAttribute('pointer-events', 'none');
        this.mainGroup.appendChild(selection);
        return selection;
    }
    removeSelection() {
        const selection = this.svg.querySelector('.selection');
        if (selection)
            selection.remove();
    }
    getMainGroup() {
        return this.mainGroup;
    }
}
exports.Renderer = Renderer;
