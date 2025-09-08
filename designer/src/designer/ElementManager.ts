import { BPMNElement, ElementType } from './types';

export class ElementManager {
  private elements: Map<string, BPMNElement> = new Map();
  private idCounter = 0;

  addElement(type: string, x: number, y: number): string {
    const id = `element_${++this.idCounter}`;
    const element: BPMNElement = {
      id,
      type,
      x,
      y,
      width: this.getDefaultWidth(type),
      height: this.getDefaultHeight(type),
      label: this.getDefaultLabel(type),
      properties: this.getDefaultProperties(type)
    };
    
    this.elements.set(id, element);
    return id;
  }

  private getDefaultWidth(type: string): number {
    if (type.includes('Event')) return 36;
    if (type.includes('Gateway')) return 50;
    return 100;
  }

  private getDefaultHeight(type: string): number {
    if (type.includes('Event')) return 36;
    if (type.includes('Gateway')) return 50;
    return 80;
  }

  private getDefaultLabel(type: string): string {
    return type.replace(/([A-Z])/g, ' $1').trim();
  }
  
  private getDefaultProperties(type: string): any {
    // Set default label position for events to bottom
    if (type.includes('Event')) {
      return {
        labelPosition: {
          position: 'bottom',
          offset: { x: 0, y: 0 }
        }
      };
    }
    return {};
  }

  getElement(id: string): BPMNElement | undefined {
    return this.elements.get(id);
  }

  getAllElements(): BPMNElement[] {
    return Array.from(this.elements.values());
  }

  updateElement(id: string, updates: Partial<BPMNElement>): void {
    const element = this.elements.get(id);
    if (element) {
      Object.assign(element, updates);
    }
  }

  deleteElement(id: string): void {
    this.elements.delete(id);
  }

  clear(): void {
    this.elements.clear();
    this.idCounter = 0;
  }

  getElementsMap(): Map<string, BPMNElement> {
    return this.elements;
  }
}
