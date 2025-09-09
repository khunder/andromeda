import { BPMNElement, Point } from './types';
import { ElementManager } from './ElementManager';

interface AlignmentLine {
  type: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
  alignedElements: BPMNElement[];
}

/**
 * Manages visual alignment guides for element positioning
 * Shows red dashed lines when elements align but doesn't affect position
 */
export class AlignmentGuides {
  private guides: SVGLineElement[] = []; // Array of visible guide lines
  private threshold = 5; // Distance threshold for alignment detection (pixels)
  
  constructor(
    private svg: SVGSVGElement,
    private elementManager: ElementManager
  ) {}
  
  /**
   * Shows alignment guides when dragging an element near other elements
   * Note: This only shows visual guides, does not snap positions
   * @param draggedElement - The element being dragged
   * @param currentX - Current X position of dragged element
   * @param currentY - Current Y position of dragged element
   * @returns The same position passed in (no snapping)
   */
  showGuides(draggedElement: BPMNElement, currentX: number, currentY: number): Point {
    this.hideGuides();
    
    const elements = this.elementManager.getAllElements().filter(el => el.id !== draggedElement.id);
    
    const draggedCenterX = currentX + draggedElement.width / 2;
    const draggedCenterY = currentY + draggedElement.height / 2;
    const draggedRight = currentX + draggedElement.width;
    const draggedBottom = currentY + draggedElement.height;
    
    // Collect all alignments
    const verticalAlignments: Map<number, AlignmentLine> = new Map();
    const horizontalAlignments: Map<number, AlignmentLine> = new Map();
    
    // Check for alignments
    elements.forEach(element => {
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;
      const right = element.x + element.width;
      const bottom = element.y + element.height;
      
      // Check vertical alignments
      // Check vertical alignments (left/right edges)
      if (Math.abs(currentX - element.x) < this.threshold) {
        // Left edge alignment
        this.addToAlignment(verticalAlignments, element.x, 'vertical', element, 
                          Math.min(currentY, element.y), Math.max(draggedBottom, bottom));
      }
      else if (Math.abs(draggedRight - right) < this.threshold) {
        // Right edge alignment
        this.addToAlignment(verticalAlignments, right, 'vertical', element,
                          Math.min(currentY, element.y), Math.max(draggedBottom, bottom));
      }
      else if (Math.abs(currentX - right) < this.threshold) {
        // Left to right alignment
        this.addToAlignment(verticalAlignments, right, 'vertical', element,
                          Math.min(currentY, element.y), Math.max(draggedBottom, bottom));
      }
      else if (Math.abs(draggedRight - element.x) < this.threshold) {
        // Right to left alignment
        this.addToAlignment(verticalAlignments, element.x, 'vertical', element,
                          Math.min(currentY, element.y), Math.max(draggedBottom, bottom));
      }
      
      // Check horizontal alignments
      // Check horizontal alignments (top/bottom edges)
      if (Math.abs(currentY - element.y) < this.threshold) {
        // Top edge alignment
        this.addToAlignment(horizontalAlignments, element.y, 'horizontal', element,
                          Math.min(currentX, element.x), Math.max(draggedRight, right));
      }
      else if (Math.abs(draggedBottom - bottom) < this.threshold) {
        // Bottom edge alignment
        this.addToAlignment(horizontalAlignments, bottom, 'horizontal', element,
                          Math.min(currentX, element.x), Math.max(draggedRight, right));
      }
      else if (Math.abs(currentY - bottom) < this.threshold) {
        // Top to bottom alignment
        this.addToAlignment(horizontalAlignments, bottom, 'horizontal', element,
                          Math.min(currentX, element.x), Math.max(draggedRight, right));
      }
      else if (Math.abs(draggedBottom - element.y) < this.threshold) {
        // Bottom to top alignment
        this.addToAlignment(horizontalAlignments, element.y, 'horizontal', element,
                          Math.min(currentX, element.x), Math.max(draggedRight, right));
      }
    });
    
    // Show alignment guides for all aligned elements
    verticalAlignments.forEach(alignment => {
      if (alignment.alignedElements.length > 0) {
        // Calculate the full extent of the guide line
        let minY = currentY;
        let maxY = draggedBottom;
        alignment.alignedElements.forEach(el => {
          minY = Math.min(minY, el.y);
          maxY = Math.max(maxY, el.y + el.height);
        });
        this.showVerticalGuide(alignment.position, minY - 10, maxY + 10);
      }
    });
    
    horizontalAlignments.forEach(alignment => {
      if (alignment.alignedElements.length > 0) {
        // Calculate the full extent of the guide line
        let minX = currentX;
        let maxX = draggedRight;
        alignment.alignedElements.forEach(el => {
          minX = Math.min(minX, el.x);
          maxX = Math.max(maxX, el.x + el.width);
        });
        this.showHorizontalGuide(alignment.position, minX - 10, maxX + 10);
      }
    });
    
    // Return original position without any snapping
    return { x: currentX, y: currentY };
  }
  
  /**
   * Adds an element to an alignment line collection
   * @param alignments - Map of alignment lines
   * @param position - Position of the alignment line
   * @param type - Whether it's a vertical or horizontal alignment
   * @param element - Element that aligns at this position
   * @param start - Start point of the alignment line
   * @param end - End point of the alignment line
   */
  private addToAlignment(
    alignments: Map<number, AlignmentLine>,
    position: number,
    type: 'vertical' | 'horizontal',
    element: BPMNElement,
    start: number,
    end: number
  ): void {
    if (!alignments.has(position)) {
      alignments.set(position, {
        type,
        position,
        start,
        end,
        alignedElements: []
      });
    }
    const alignment = alignments.get(position)!;
    alignment.alignedElements.push(element);
    alignment.start = Math.min(alignment.start, start);
    alignment.end = Math.max(alignment.end, end);
  }
  
  /**
   * Creates and displays a vertical alignment guide
   * @param x - X position of the vertical line
   * @param startY - Y start position
   * @param endY - Y end position
   */
  private showVerticalGuide(x: number, startY: number, endY: number): void {
    const guide = this.createLine(x, startY, x, endY);
    this.guides.push(guide);
    this.svg.appendChild(guide);
  }
  
  /**
   * Creates and displays a horizontal alignment guide
   * @param y - Y position of the horizontal line
   * @param startX - X start position
   * @param endX - X end position
   */
  private showHorizontalGuide(y: number, startX: number, endX: number): void {
    const guide = this.createLine(startX, y, endX, y);
    this.guides.push(guide);
    this.svg.appendChild(guide);
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
  
  /**
   * Removes all visible alignment guides from the DOM
   */
  hideGuides(): void {
    this.guides.forEach(guide => guide.remove());
    this.guides = [];
  }
}
