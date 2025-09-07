// Base renderer for all BPMN elements

import { BPMNElement, Bounds } from '../types';

export abstract class BaseRenderer {
  protected svgNS = 'http://www.w3.org/2000/svg';

  abstract render(element: BPMNElement, container: SVGGElement): SVGElement;

  protected createGroup(id: string, className: string): SVGGElement {
    const group = document.createElementNS(this.svgNS, 'g') as SVGGElement;
    group.setAttribute('id', id);
    group.setAttribute('class', className);
    group.setAttribute('data-element-id', id);
    return group;
  }

  protected createRect(bounds: Bounds, attrs?: Record<string, string>): SVGRectElement {
    const rect = document.createElementNS(this.svgNS, 'rect') as SVGRectElement;
    rect.setAttribute('x', String(bounds.x));
    rect.setAttribute('y', String(bounds.y));
    rect.setAttribute('width', String(bounds.width));
    rect.setAttribute('height', String(bounds.height));
    
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        rect.setAttribute(key, value);
      });
    }
    
    return rect;
  }

  protected createCircle(cx: number, cy: number, r: number, attrs?: Record<string, string>): SVGCircleElement {
    const circle = document.createElementNS(this.svgNS, 'circle') as SVGCircleElement;
    circle.setAttribute('cx', String(cx));
    circle.setAttribute('cy', String(cy));
    circle.setAttribute('r', String(r));
    
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        circle.setAttribute(key, value);
      });
    }
    
    return circle;
  }

  protected createPath(d: string, attrs?: Record<string, string>): SVGPathElement {
    const path = document.createElementNS(this.svgNS, 'path') as SVGPathElement;
    path.setAttribute('d', d);
    
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        path.setAttribute(key, value);
      });
    }
    
    return path;
  }

  protected createText(x: number, y: number, text: string, attrs?: Record<string, string>): SVGTextElement {
    const textElement = document.createElementNS(this.svgNS, 'text') as SVGTextElement;
    textElement.setAttribute('x', String(x));
    textElement.setAttribute('y', String(y));
    textElement.textContent = text;
    
    // Default text attributes
    textElement.setAttribute('text-anchor', 'middle');
    textElement.setAttribute('dominant-baseline', 'middle');
    textElement.setAttribute('font-family', 'Arial, sans-serif');
    textElement.setAttribute('font-size', '12');
    
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        textElement.setAttribute(key, value);
      });
    }
    
    return textElement;
  }

  protected createPolygon(points: string, attrs?: Record<string, string>): SVGPolygonElement {
    const polygon = document.createElementNS(this.svgNS, 'polygon') as SVGPolygonElement;
    polygon.setAttribute('points', points);
    
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        polygon.setAttribute(key, value);
      });
    }
    
    return polygon;
  }

  protected createLine(x1: number, y1: number, x2: number, y2: number, attrs?: Record<string, string>): SVGLineElement {
    const line = document.createElementNS(this.svgNS, 'line') as SVGLineElement;
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        line.setAttribute(key, value);
      });
    }
    
    return line;
  }

  protected addLabel(container: SVGGElement, element: BPMNElement): void {
    if (element.label) {
      const centerX = element.bounds.x + element.bounds.width / 2;
      const centerY = element.bounds.y + element.bounds.height / 2;
      
      const text = this.createText(centerX, centerY, element.label, {
        'font-size': '11',
        'fill': '#000'
      });
      
      container.appendChild(text);
    }
  }
}
