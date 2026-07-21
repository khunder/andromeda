"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElementManager = void 0;
class ElementManager {
    constructor() {
        this.elements = new Map();
        this.idCounter = 0;
    }
    addElement(type, x, y) {
        const id = `element_${++this.idCounter}`;
        const element = {
            id,
            type,
            x,
            y,
            width: this.getDefaultWidth(type),
            height: this.getDefaultHeight(type),
            label: this.getDefaultLabel(type)
        };
        this.elements.set(id, element);
        return id;
    }
    getDefaultWidth(type) {
        if (type.includes('Event'))
            return 36;
        if (type.includes('Gateway'))
            return 50;
        return 100;
    }
    getDefaultHeight(type) {
        if (type.includes('Event'))
            return 36;
        if (type.includes('Gateway'))
            return 50;
        return 80;
    }
    getDefaultLabel(type) {
        return type.replace(/([A-Z])/g, ' $1').trim();
    }
    getElement(id) {
        return this.elements.get(id);
    }
    getAllElements() {
        return Array.from(this.elements.values());
    }
    updateElement(id, updates) {
        const element = this.elements.get(id);
        if (element) {
            Object.assign(element, updates);
        }
    }
    deleteElement(id) {
        this.elements.delete(id);
    }
    clear() {
        this.elements.clear();
        this.idCounter = 0;
    }
    getElementsMap() {
        return this.elements;
    }
}
exports.ElementManager = ElementManager;
