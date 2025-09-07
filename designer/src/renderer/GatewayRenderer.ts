// Renderer for BPMN Gateway elements

import { BaseRenderer } from './BaseRenderer';
import { BPMNElement, BPMNElementType } from '../types';

export class GatewayRenderer extends BaseRenderer {
  render(element: BPMNElement, container: SVGGElement): SVGElement {
    const group = this.createGroup(element.id, 'bpmn-gateway');
    
    const centerX = element.bounds.x + element.bounds.width / 2;
    const centerY = element.bounds.y + element.bounds.height / 2;
    const size = Math.min(element.bounds.width, element.bounds.height) / 2;
    
    // Create diamond shape
    const points = `${centerX},${centerY - size} ${centerX + size},${centerY} ${centerX},${centerY + size} ${centerX - size},${centerY}`;
    const diamond = this.createPolygon(points, {
      'fill': '#fff',
      'stroke': '#000',
      'stroke-width': '2'
    });
    
    group.appendChild(diamond);
    
    // Add gateway type icon
    this.addGatewayTypeIcon(group, element, centerX, centerY, size * 0.6);
    
    // Add label below the gateway
    if (element.label) {
      const text = this.createText(centerX, element.bounds.y + element.bounds.height + 15, element.label, {
        'font-size': '11',
        'fill': '#000'
      });
      group.appendChild(text);
    }
    
    container.appendChild(group);
    return group;
  }

  private addGatewayTypeIcon(container: SVGGElement, element: BPMNElement, cx: number, cy: number, size: number): void {
    switch (element.type) {
      case BPMNElementType.EXCLUSIVE_GATEWAY:
        this.addExclusiveIcon(container, cx, cy, size);
        break;
      case BPMNElementType.PARALLEL_GATEWAY:
        this.addParallelIcon(container, cx, cy, size);
        break;
      case BPMNElementType.INCLUSIVE_GATEWAY:
        this.addInclusiveIcon(container, cx, cy, size);
        break;
      case BPMNElementType.EVENT_BASED_GATEWAY:
        this.addEventBasedIcon(container, cx, cy, size);
        break;
      case BPMNElementType.COMPLEX_GATEWAY:
        this.addComplexIcon(container, cx, cy, size);
        break;
    }
  }

  private addExclusiveIcon(container: SVGGElement, cx: number, cy: number, size: number): void {
    // X shape for exclusive gateway
    const path = `M ${cx - size} ${cy - size} L ${cx + size} ${cy + size} 
                  M ${cx - size} ${cy + size} L ${cx + size} ${cy - size}`;
    const x = this.createPath(path, {
      'fill': 'none',
      'stroke': '#000',
      'stroke-width': '3'
    });
    container.appendChild(x);
  }

  private addParallelIcon(container: SVGGElement, cx: number, cy: number, size: number): void {
    // + shape for parallel gateway
    const path = `M ${cx} ${cy - size} L ${cx} ${cy + size} 
                  M ${cx - size} ${cy} L ${cx + size} ${cy}`;
    const plus = this.createPath(path, {
      'fill': 'none',
      'stroke': '#000',
      'stroke-width': '3'
    });
    container.appendChild(plus);
  }

  private addInclusiveIcon(container: SVGGElement, cx: number, cy: number, size: number): void {
    // Circle for inclusive gateway
    const circle = this.createCircle(cx, cy, size * 0.6, {
      'fill': 'none',
      'stroke': '#000',
      'stroke-width': '3'
    });
    container.appendChild(circle);
  }

  private addEventBasedIcon(container: SVGGElement, cx: number, cy: number, size: number): void {
    // Double circle with pentagon for event-based gateway
    const outerCircle = this.createCircle(cx, cy, size * 0.8, {
      'fill': 'none',
      'stroke': '#000',
      'stroke-width': '1'
    });
    
    const innerCircle = this.createCircle(cx, cy, size * 0.6, {
      'fill': 'none',
      'stroke': '#000',
      'stroke-width': '1'
    });
    
    // Pentagon inside
    const pentagonSize = size * 0.4;
    let pentagonPath = '';
    for (let i = 0; i < 5; i++) {
      const angle = (i * 72 - 90) * Math.PI / 180;
      const x = cx + Math.cos(angle) * pentagonSize;
      const y = cy + Math.sin(angle) * pentagonSize;
      if (i === 0) {
        pentagonPath += `M ${x} ${y} `;
      } else {
        pentagonPath += `L ${x} ${y} `;
      }
    }
    pentagonPath += 'Z';
    
    const pentagon = this.createPath(pentagonPath, {
      'fill': 'none',
      'stroke': '#000',
      'stroke-width': '1'
    });
    
    container.appendChild(outerCircle);
    container.appendChild(innerCircle);
    container.appendChild(pentagon);
  }

  private addComplexIcon(container: SVGGElement, cx: number, cy: number, size: number): void {
    // * shape for complex gateway
    const path = `M ${cx} ${cy - size} L ${cx} ${cy + size} 
                  M ${cx - size} ${cy} L ${cx + size} ${cy}
                  M ${cx - size * 0.7} ${cy - size * 0.7} L ${cx + size * 0.7} ${cy + size * 0.7}
                  M ${cx - size * 0.7} ${cy + size * 0.7} L ${cx + size * 0.7} ${cy - size * 0.7}`;
    const star = this.createPath(path, {
      'fill': 'none',
      'stroke': '#000',
      'stroke-width': '2'
    });
    container.appendChild(star);
  }
}
