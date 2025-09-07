// Renderer for BPMN Event elements

import { BaseRenderer } from './BaseRenderer';
import { BPMNElement, BPMNElementType } from '../types';

export class EventRenderer extends BaseRenderer {
  render(element: BPMNElement, container: SVGGElement): SVGElement {
    const group = this.createGroup(element.id, 'bpmn-event');
    
    const centerX = element.bounds.x + element.bounds.width / 2;
    const centerY = element.bounds.y + element.bounds.height / 2;
    const radius = Math.min(element.bounds.width, element.bounds.height) / 2;
    
    // Determine circle style based on event type
    let strokeWidth = '2';
    let strokeDasharray = 'none';
    let fillColor = '#fff';
    
    if (element.type === BPMNElementType.END_EVENT) {
      strokeWidth = '4';
    } else if (element.type === BPMNElementType.INTERMEDIATE_CATCH_EVENT || 
               element.type === BPMNElementType.INTERMEDIATE_THROW_EVENT) {
      // Double circle for intermediate events
      const outerCircle = this.createCircle(centerX, centerY, radius, {
        'fill': fillColor,
        'stroke': '#000',
        'stroke-width': '1'
      });
      group.appendChild(outerCircle);
      
      const innerCircle = this.createCircle(centerX, centerY, radius - 3, {
        'fill': fillColor,
        'stroke': '#000',
        'stroke-width': '1'
      });
      group.appendChild(innerCircle);
    } else if (element.type === BPMNElementType.BOUNDARY_EVENT) {
      strokeDasharray = '5,5';
      // Double circle for boundary events
      const outerCircle = this.createCircle(centerX, centerY, radius, {
        'fill': fillColor,
        'stroke': '#000',
        'stroke-width': '1',
        'stroke-dasharray': strokeDasharray
      });
      group.appendChild(outerCircle);
      
      const innerCircle = this.createCircle(centerX, centerY, radius - 3, {
        'fill': fillColor,
        'stroke': '#000',
        'stroke-width': '1',
        'stroke-dasharray': strokeDasharray
      });
      group.appendChild(innerCircle);
    } else {
      // Single circle for start events
      const circle = this.createCircle(centerX, centerY, radius, {
        'fill': fillColor,
        'stroke': '#000',
        'stroke-width': strokeWidth,
        'stroke-dasharray': strokeDasharray
      });
      group.appendChild(circle);
    }
    
    // Add event type icon (timer, message, error, etc.)
    this.addEventTypeIcon(group, element, centerX, centerY, radius * 0.6);
    
    // Add label below the event
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

  private addEventTypeIcon(container: SVGGElement, element: BPMNElement, cx: number, cy: number, size: number): void {
    // This is a simplified version - you can add more event types
    // For now, just add a simple envelope icon for message events as an example
    if (element.label && element.label.toLowerCase().includes('message')) {
      const envelope = this.createPath(
        `M ${cx - size} ${cy - size/2} 
         L ${cx + size} ${cy - size/2}
         L ${cx + size} ${cy + size/2}
         L ${cx - size} ${cy + size/2} Z
         M ${cx - size} ${cy - size/2}
         L ${cx} ${cy + size/4}
         L ${cx + size} ${cy - size/2}`,
        {
          'fill': 'none',
          'stroke': '#000',
          'stroke-width': '1.5'
        }
      );
      container.appendChild(envelope);
    }
  }
}
