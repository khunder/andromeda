import { BPMNElement, Point } from './types';
import { ElementManager } from './ElementManager';
import { ConnectionManager } from './ConnectionManager';
import { ConnectionValidator } from './ConnectionValidator';

export class ConnectionHandler {
  private isDrawing = false;
  private sourceElement: BPMNElement | null = null;
  private tempLine: SVGLineElement | null = null;
  private targetIndicator: SVGCircleElement | null = null;
  private currentTarget: BPMNElement | null = null;

  constructor(
    private svg: SVGSVGElement,
    private elementManager: ElementManager,
    private connectionManager: ConnectionManager,
    private onConnectionCreated: (sourceId: string, targetId: string) => void
  ) {}

  startConnection(sourceElement: BPMNElement): void {
    if (!ConnectionValidator.canHaveOutgoingConnections(sourceElement)) {
      return;
    }

    this.isDrawing = true;
    this.sourceElement = sourceElement;
    
    // Create temporary line
    this.tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.tempLine.setAttribute('stroke', '#1e88e5');
    this.tempLine.setAttribute('stroke-width', '2');
    this.tempLine.setAttribute('stroke-dasharray', '5,5');
    this.tempLine.style.pointerEvents = 'none';
    
    const startPoint = this.getElementCenter(sourceElement);
    this.tempLine.setAttribute('x1', String(startPoint.x));
    this.tempLine.setAttribute('y1', String(startPoint.y));
    this.tempLine.setAttribute('x2', String(startPoint.x));
    this.tempLine.setAttribute('y2', String(startPoint.y));
    
    this.svg.appendChild(this.tempLine);
    
    // Create target indicator
    this.targetIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.targetIndicator.setAttribute('r', '8');
    this.targetIndicator.setAttribute('fill', 'none');
    this.targetIndicator.setAttribute('stroke', '#4caf50');
    this.targetIndicator.setAttribute('stroke-width', '3');
    this.targetIndicator.style.display = 'none';
    this.targetIndicator.style.pointerEvents = 'none';
    this.svg.appendChild(this.targetIndicator);
  }

  updateConnection(mousePoint: Point): void {
    if (!this.isDrawing || !this.tempLine || !this.sourceElement) return;
    
    // Update temp line end point
    this.tempLine.setAttribute('x2', String(mousePoint.x));
    this.tempLine.setAttribute('y2', String(mousePoint.y));
    
    // Check if mouse is over a valid target
    const targetElement = this.getElementAtPoint(mousePoint);
    
    if (targetElement && targetElement.id !== this.sourceElement.id) {
      const canConnect = ConnectionValidator.canConnect(this.sourceElement, targetElement);
      
      if (canConnect) {
        // Show valid target indicator
        this.currentTarget = targetElement;
        const center = this.getElementCenter(targetElement);
        
        if (this.targetIndicator) {
          this.targetIndicator.style.display = 'block';
          this.targetIndicator.setAttribute('cx', String(center.x));
          this.targetIndicator.setAttribute('cy', String(center.y));
          this.targetIndicator.setAttribute('stroke', '#4caf50');
          
          // Snap line to target center
          this.tempLine.setAttribute('x2', String(center.x));
          this.tempLine.setAttribute('y2', String(center.y));
        }
      } else {
        // Show invalid target indicator
        this.currentTarget = null;
        const center = this.getElementCenter(targetElement);
        
        if (this.targetIndicator) {
          this.targetIndicator.style.display = 'block';
          this.targetIndicator.setAttribute('cx', String(center.x));
          this.targetIndicator.setAttribute('cy', String(center.y));
          this.targetIndicator.setAttribute('stroke', '#f44336');
        }
      }
    } else {
      // Hide target indicator
      this.currentTarget = null;
      if (this.targetIndicator) {
        this.targetIndicator.style.display = 'none';
      }
    }
  }

  endConnection(): void {
    if (!this.isDrawing) return;
    
    // Create connection if valid target
    if (this.sourceElement && this.currentTarget) {
      if (ConnectionValidator.canConnect(this.sourceElement, this.currentTarget)) {
        this.onConnectionCreated(this.sourceElement.id, this.currentTarget.id);
      }
    }
    
    // Clean up
    this.cleanup();
  }

  cancelConnection(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.tempLine) {
      this.tempLine.remove();
      this.tempLine = null;
    }
    
    if (this.targetIndicator) {
      this.targetIndicator.remove();
      this.targetIndicator = null;
    }
    
    this.isDrawing = false;
    this.sourceElement = null;
    this.currentTarget = null;
  }

  private getElementCenter(element: BPMNElement): Point {
    return {
      x: element.x + element.width / 2,
      y: element.y + element.height / 2
    };
  }

  private getElementAtPoint(point: Point): BPMNElement | null {
    const elements = this.elementManager.getAllElements();
    
    // Check elements in reverse order (top to bottom)
    for (let i = elements.length - 1; i >= 0; i--) {
      const element = elements[i];
      if (this.isPointInElement(point, element)) {
        return element;
      }
    }
    
    return null;
  }

  private isPointInElement(point: Point, element: BPMNElement): boolean {
    return point.x >= element.x &&
           point.x <= element.x + element.width &&
           point.y >= element.y &&
           point.y <= element.y + element.height;
  }

  isDrawingConnection(): boolean {
    return this.isDrawing;
  }

  getSourceElement(): BPMNElement | null {
    return this.sourceElement;
  }
}
