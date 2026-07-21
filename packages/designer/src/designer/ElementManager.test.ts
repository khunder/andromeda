import { describe, it, expect, beforeEach } from 'vitest';
import { ElementManager } from './ElementManager';
import { BPMNElement } from './types';

describe('ElementManager', () => {
  let elementManager: ElementManager;

  beforeEach(() => {
    elementManager = new ElementManager();
  });

  describe('addElement', () => {
    it('should add a new element with correct properties', () => {
      const id = elementManager.addElement('userTask', 100, 200);
      const element = elementManager.getElement(id);

      expect(element).toBeDefined();
      expect(element?.type).toBe('userTask');
      expect(element?.x).toBe(100);
      expect(element?.y).toBe(200);
      expect(element?.width).toBe(100);
      expect(element?.height).toBe(80);
    });

    it('should generate unique IDs for each element', () => {
      const id1 = elementManager.addElement('userTask', 0, 0);
      const id2 = elementManager.addElement('userTask', 100, 100);

      expect(id1).not.toBe(id2);
      expect(elementManager.getElement(id1)).toBeDefined();
      expect(elementManager.getElement(id2)).toBeDefined();
    });

    it('should set correct dimensions for events', () => {
      const id = elementManager.addElement('startEvent', 50, 50);
      const element = elementManager.getElement(id);

      expect(element?.width).toBe(36);
      expect(element?.height).toBe(36);
    });

    it('should set correct dimensions for gateways', () => {
      const id = elementManager.addElement('exclusiveGateway', 50, 50);
      const element = elementManager.getElement(id);

      expect(element?.width).toBe(50);
      expect(element?.height).toBe(50);
    });
  });

  describe('updateElement', () => {
    it('should update element properties', () => {
      const id = elementManager.addElement('userTask', 100, 200);
      
      elementManager.updateElement(id, {
        x: 150,
        y: 250,
        label: 'Updated Task'
      });

      const element = elementManager.getElement(id);
      expect(element?.x).toBe(150);
      expect(element?.y).toBe(250);
      expect(element?.label).toBe('Updated Task');
    });

    it('should not update non-existent element', () => {
      const result = elementManager.updateElement('non-existent', { x: 100 });
      expect(result).toBeUndefined();
    });
  });

  describe('deleteElement', () => {
    it('should remove element from manager', () => {
      const id = elementManager.addElement('userTask', 100, 200);
      expect(elementManager.getElement(id)).toBeDefined();

      elementManager.deleteElement(id);
      expect(elementManager.getElement(id)).toBeUndefined();
    });

    it('should handle deletion of non-existent element', () => {
      expect(() => {
        elementManager.deleteElement('non-existent');
      }).not.toThrow();
    });
  });

  describe('getAllElements', () => {
    it('should return all elements', () => {
      const id1 = elementManager.addElement('userTask', 0, 0);
      const id2 = elementManager.addElement('startEvent', 100, 100);
      const id3 = elementManager.addElement('endEvent', 200, 200);

      const elements = elementManager.getAllElements();
      expect(elements).toHaveLength(3);
      expect(elements.map(e => e.id)).toContain(id1);
      expect(elements.map(e => e.id)).toContain(id2);
      expect(elements.map(e => e.id)).toContain(id3);
    });

    it('should return empty array when no elements', () => {
      const elements = elementManager.getAllElements();
      expect(elements).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should remove all elements', () => {
      elementManager.addElement('userTask', 0, 0);
      elementManager.addElement('startEvent', 100, 100);
      expect(elementManager.getAllElements()).toHaveLength(2);

      elementManager.clear();
      expect(elementManager.getAllElements()).toHaveLength(0);
    });
  });
});
