import { BPMNElement, Point } from './types';
import { ElementManager } from './ElementManager';

interface AlignmentLine {
  type: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
}

export class AlignmentGuides {
  private verticalGuide: SVGLineElement | null = null;
  private horizontalGuide: SVGLineElement | null = null;
  private threshold = 5; // Snap threshold in pixels
  
  constructor(
    private svg: SVGSVGElement,
    private elementManager: ElementManager
  ) {}
  
  showGuides(draggedElement: BPMNElement, currentX: number, currentY: number): Point {
    this.hideGuides();
    
    const elements = this.elementManager.getAllElements().filter(el => el.id !== draggedElement.id);
    let snapX = currentX;
    let snapY = currentY;
    
    const draggedCenterX = currentX + draggedElement.width / 2;
    const draggedCenterY = currentY + draggedElement.height / 2;
    const draggedRight = currentX + draggedElement.width;
    const draggedBottom = currentY + draggedElement.height;
    
    let verticalAlign: AlignmentLine | undefined = undefined;
    let horizontalAlign: AlignmentLine | undefined = undefined;
    
    // Check for alignments
    elements.forEach(element => {
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;
      const right = element.x + element.width;
      const bottom = element.y + element.height;
      
      // Vertical alignments (left, center, right)
      if (!verticalAlign) {
        // Left edge alignment
        if (Math.abs(currentX - element.x) < this.threshold) {
          snapX = element.x;
          verticalAlign = {
            type: 'vertical',
            position: element.x,
            start: Math.min(currentY, element.y),
            end: Math.max(draggedBottom, bottom)
          };
        }
        // Right edge alignment
        else if (Math.abs(draggedRight - right) < this.threshold) {
          snapX = right - draggedElement.width;
          verticalAlign = {
            type: 'vertical',
            position: right,
            start: Math.min(currentY, element.y),
            end: Math.max(draggedBottom, bottom)
          };
        }
        // Center alignment
        else if (Math.abs(draggedCenterX - centerX) < this.threshold) {
          snapX = centerX - draggedElement.width / 2;
          verticalAlign = {
            type: 'vertical',
            position: centerX,
            start: Math.min(currentY, element.y),
            end: Math.max(draggedBottom, bottom)
          };
        }
        // Left to right alignment
        else if (Math.abs(currentX - right) < this.threshold) {
          snapX = right;
          verticalAlign = {
            type: 'vertical',
            position: right,
            start: Math.min(currentY, element.y),
            end: Math.max(draggedBottom, bottom)
          };
        }
        // Right to left alignment
        else if (Math.abs(draggedRight - element.x) < this.threshold) {
          snapX = element.x - draggedElement.width;
          verticalAlign = {
            type: 'vertical',
            position: element.x,
            start: Math.min(currentY, element.y),
            end: Math.max(draggedBottom, bottom)
          };
        }
      }
      
      // Horizontal alignments (top, middle, bottom)
      if (!horizontalAlign) {
        // Top edge alignment
        if (Math.abs(currentY - element.y) < this.threshold) {
          snapY = element.y;
          horizontalAlign = {
            type: 'horizontal',
            position: element.y,
            start: Math.min(currentX, element.x),
            end: Math.max(draggedRight, right)
          };
        }
        // Bottom edge alignment
        else if (Math.abs(draggedBottom - bottom) < this.threshold) {
          snapY = bottom - draggedElement.height;
          horizontalAlign = {
            type: 'horizontal',
            position: bottom,
            start: Math.min(currentX, element.x),
            end: Math.max(draggedRight, right)
          };
        }
        // Middle alignment
        else if (Math.abs(draggedCenterY - centerY) < this.threshold) {
          snapY = centerY - draggedElement.height / 2;
          horizontalAlign = {
            type: 'horizontal',
            position: centerY,
            start: Math.min(currentX, element.x),
            end: Math.max(draggedRight, right)
          };
        }
        // Top to bottom alignment
        else if (Math.abs(currentY - bottom) < this.threshold) {
          snapY = bottom;
          horizontalAlign = {
            type: 'horizontal',
            position: bottom,
            start: Math.min(currentX, element.x),
            end: Math.max(draggedRight, right)
          };
        }
        // Bottom to top alignment
        else if (Math.abs(draggedBottom - element.y) < this.threshold) {
          snapY = element.y - draggedElement.height;
          horizontalAlign = {
            type: 'horizontal',
            position: element.y,
            start: Math.min(currentX, element.x),
            end: Math.max(draggedRight, right)
          };
        }
      }
    });
    
    // Show alignment guides
    if (verticalAlign !== undefined) {
      const vAlign: AlignmentLine = verticalAlign;
      this.showVerticalGuide(vAlign.position, vAlign.start, vAlign.end);
    }
    if (horizontalAlign !== undefined) {
      const hAlign: AlignmentLine = horizontalAlign;
      this.showHorizontalGuide(hAlign.position, hAlign.start, hAlign.end);
    }
    
    return { x: snapX, y: snapY };
  }
  
  private showVerticalGuide(x: number, startY: number, endY: number): void {
    this.verticalGuide = this.createLine(x, startY, x, endY);
    this.svg.appendChild(this.verticalGuide);
  }
  
  private showHorizontalGuide(y: number, startX: number, endX: number): void {
    this.horizontalGuide = this.createLine(startX, y, endX, y);
    this.svg.appendChild(this.horizontalGuide);
  }
  
  private createLine(x1: number, y1: number, x2: number, y2: number): SVGLineElement {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    line.setAttribute('stroke', '#ff6b6b');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-dasharray', '5,5');
    line.style.pointerEvents = 'none';
    line.style.zIndex = '9999';
    return line;
  }
  
  hideGuides(): void {
    if (this.verticalGuide) {
      this.verticalGuide.remove();
      this.verticalGuide = null;
    }
    if (this.horizontalGuide) {
      this.horizontalGuide.remove();
      this.horizontalGuide = null;
    }
  }
}
