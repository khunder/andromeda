// Renderer for BPMN Task elements

import { BaseRenderer } from './BaseRenderer';
import { BPMNElement, BPMNElementType } from '../types';

export class TaskRenderer extends BaseRenderer {
  render(element: BPMNElement, container: SVGGElement): SVGElement {
    const group = this.createGroup(element.id, 'bpmn-task');
    
    // Create task rectangle with rounded corners
    const rect = this.createRect(element.bounds, {
      'rx': '10',
      'ry': '10',
      'fill': '#fff',
      'stroke': '#000',
      'stroke-width': '2'
    });
    
    group.appendChild(rect);
    
    // Add task type icon based on type
    this.addTaskTypeIcon(group, element);
    
    // Add label
    this.addLabel(group, element);
    
    container.appendChild(group);
    return group;
  }

  private addTaskTypeIcon(container: SVGGElement, element: BPMNElement): void {
    const iconX = element.bounds.x + 5;
    const iconY = element.bounds.y + 5;
    const iconSize = 15;
    
    switch (element.type) {
      case BPMNElementType.USER_TASK:
        this.addUserIcon(container, iconX, iconY, iconSize);
        break;
      case BPMNElementType.SERVICE_TASK:
        this.addServiceIcon(container, iconX, iconY, iconSize);
        break;
      case BPMNElementType.SCRIPT_TASK:
        this.addScriptIcon(container, iconX, iconY, iconSize);
        break;
      case BPMNElementType.BUSINESS_RULE_TASK:
        this.addBusinessRuleIcon(container, iconX, iconY, iconSize);
        break;
      case BPMNElementType.SEND_TASK:
        this.addSendIcon(container, iconX, iconY, iconSize);
        break;
      case BPMNElementType.RECEIVE_TASK:
        this.addReceiveIcon(container, iconX, iconY, iconSize);
        break;
      case BPMNElementType.MANUAL_TASK:
        this.addManualIcon(container, iconX, iconY, iconSize);
        break;
    }
  }

  private addUserIcon(container: SVGGElement, x: number, y: number, size: number): void {
    // User icon (simplified person shape)
    const group = document.createElementNS(this.svgNS, 'g');
    
    // Head
    const head = this.createCircle(x + size/2, y + size/3, size/4, {
      'fill': '#000',
      'stroke': 'none'
    });
    
    // Body
    const bodyPath = `M ${x + size/4} ${y + size/2} 
                      Q ${x + size/2} ${y + size*0.7} ${x + size*0.75} ${y + size/2}
                      L ${x + size*0.75} ${y + size*0.9}
                      L ${x + size/4} ${y + size*0.9} Z`;
    const body = this.createPath(bodyPath, {
      'fill': '#000',
      'stroke': 'none'
    });
    
    group.appendChild(head);
    group.appendChild(body);
    container.appendChild(group);
  }

  private addServiceIcon(container: SVGGElement, x: number, y: number, size: number): void {
    // Service icon (gear shape)
    const centerX = x + size/2;
    const centerY = y + size/2;
    const outerRadius = size/2;
    const innerRadius = size/3;
    
    let path = '';
    const teeth = 8;
    
    for (let i = 0; i < teeth; i++) {
      const angle = (i / teeth) * Math.PI * 2;
      const nextAngle = ((i + 0.5) / teeth) * Math.PI * 2;
      
      const x1 = centerX + Math.cos(angle) * outerRadius;
      const y1 = centerY + Math.sin(angle) * outerRadius;
      const x2 = centerX + Math.cos(nextAngle) * innerRadius;
      const y2 = centerY + Math.sin(nextAngle) * innerRadius;
      
      if (i === 0) {
        path += `M ${x1} ${y1} `;
      } else {
        path += `L ${x1} ${y1} `;
      }
      path += `L ${x2} ${y2} `;
    }
    path += 'Z';
    
    const gear = this.createPath(path, {
      'fill': '#000',
      'stroke': 'none'
    });
    
    container.appendChild(gear);
  }

  private addScriptIcon(container: SVGGElement, x: number, y: number, size: number): void {
    // Script icon (document with lines)
    const scriptPath = `M ${x} ${y} 
                        L ${x + size*0.8} ${y}
                        L ${x + size} ${y + size*0.2}
                        L ${x + size} ${y + size}
                        L ${x} ${y + size} Z`;
    const script = this.createPath(scriptPath, {
      'fill': 'none',
      'stroke': '#000',
      'stroke-width': '1.5'
    });
    
    // Add lines
    for (let i = 0; i < 3; i++) {
      const lineY = y + size * (0.4 + i * 0.15);
      const line = this.createLine(x + size*0.1, lineY, x + size*0.7, lineY, {
        'stroke': '#000',
        'stroke-width': '1'
      });
      container.appendChild(line);
    }
    
    container.appendChild(script);
  }

  private addBusinessRuleIcon(container: SVGGElement, x: number, y: number, size: number): void {
    // Business rule icon (table/grid)
    const rect = this.createRect({
      x: x,
      y: y,
      width: size,
      height: size
    }, {
      'fill': 'none',
      'stroke': '#000',
      'stroke-width': '1.5'
    });
    
    // Horizontal line
    const hLine = this.createLine(x, y + size/3, x + size, y + size/3, {
      'stroke': '#000',
      'stroke-width': '1.5'
    });
    
    // Vertical line
    const vLine = this.createLine(x + size/2, y + size/3, x + size/2, y + size, {
      'stroke': '#000',
      'stroke-width': '1.5'
    });
    
    container.appendChild(rect);
    container.appendChild(hLine);
    container.appendChild(vLine);
  }

  private addSendIcon(container: SVGGElement, x: number, y: number, size: number): void {
    // Send icon (envelope with arrow)
    const envelopePath = `M ${x} ${y + size*0.3} 
                          L ${x + size/2} ${y + size*0.6}
                          L ${x + size} ${y + size*0.3}
                          L ${x + size} ${y + size*0.9}
                          L ${x} ${y + size*0.9} Z`;
    const envelope = this.createPath(envelopePath, {
      'fill': '#000',
      'stroke': 'none'
    });
    
    const topPath = `M ${x} ${y + size*0.3} 
                     L ${x + size/2} ${y + size*0.6}
                     L ${x + size} ${y + size*0.3}`;
    const top = this.createPath(topPath, {
      'fill': 'none',
      'stroke': '#fff',
      'stroke-width': '1'
    });
    
    container.appendChild(envelope);
    container.appendChild(top);
  }

  private addReceiveIcon(container: SVGGElement, x: number, y: number, size: number): void {
    // Receive icon (empty envelope)
    const envelopePath = `M ${x} ${y + size*0.3} 
                          L ${x + size} ${y + size*0.3}
                          L ${x + size} ${y + size*0.9}
                          L ${x} ${y + size*0.9} Z`;
    const envelope = this.createPath(envelopePath, {
      'fill': 'none',
      'stroke': '#000',
      'stroke-width': '1.5'
    });
    
    const flapPath = `M ${x} ${y + size*0.3} 
                      L ${x + size/2} ${y + size*0.6}
                      L ${x + size} ${y + size*0.3}`;
    const flap = this.createPath(flapPath, {
      'fill': 'none',
      'stroke': '#000',
      'stroke-width': '1.5'
    });
    
    container.appendChild(envelope);
    container.appendChild(flap);
  }

  private addManualIcon(container: SVGGElement, x: number, y: number, size: number): void {
    // Manual icon (hand)
    const handPath = `M ${x + size*0.2} ${y + size*0.5}
                      C ${x + size*0.1} ${y + size*0.3} ${x + size*0.3} ${y + size*0.2} ${x + size*0.4} ${y + size*0.3}
                      L ${x + size*0.5} ${y + size*0.2}
                      L ${x + size*0.6} ${y + size*0.3}
                      L ${x + size*0.7} ${y + size*0.2}
                      L ${x + size*0.8} ${y + size*0.3}
                      L ${x + size*0.8} ${y + size*0.7}
                      C ${x + size*0.8} ${y + size*0.8} ${x + size*0.7} ${y + size*0.9} ${x + size*0.5} ${y + size*0.9}
                      C ${x + size*0.3} ${y + size*0.9} ${x + size*0.2} ${y + size*0.8} ${x + size*0.2} ${y + size*0.5} Z`;
    const hand = this.createPath(handPath, {
      'fill': '#000',
      'stroke': 'none'
    });
    
    container.appendChild(hand);
  }
}
