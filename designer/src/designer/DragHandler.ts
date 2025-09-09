import { BPMNElement, Point, DragState, Connection } from './types';
import { ElementManager } from './ElementManager';
import { ConnectionManager } from './ConnectionManager';
import { Renderer } from './Renderer';
import { AlignmentGuides } from './AlignmentGuides';
import { ConnectionInsertHandler } from './ConnectionInsertHandler';

/**
 * Handles dragging behavior for BPMN elements
 * Manages element movement, visual feedback, alignment guides, and smart injection
 */
export class DragHandler {
  private dragState: DragState = {
    isDragging: false,
    element: null,
    offset: { x: 0, y: 0 },
    originalPosition: null,
    shadowGroup: null,
    shadowConnections: []
  };
  private undoRedoManager: any = null;
  private alignmentGuides: AlignmentGuides;
  private connectionInsertHandler: ConnectionInsertHandler;
  private originalElementGroup: SVGGElement | null = null; // The actual element being dragged
  private injectionIndicator: SVGRectElement | null = null; // Green indicator for injection position
  private highlightedConnection: string | null = null; // Connection being hovered over

  constructor(
    private elementManager: ElementManager,
    private connectionManager: ConnectionManager,
    private renderer: Renderer,
    private svg: SVGSVGElement,
    private onDragEnd: () => void
  ) {
    this.alignmentGuides = new AlignmentGuides(svg, elementManager);
    this.connectionInsertHandler = new ConnectionInsertHandler(
      svg,
      elementManager,
      connectionManager,
      () => this.onDragEnd()
    );
  }

  /**
   * Initiates dragging for an element
   * @param element - The BPMN element to start dragging
   * @param mousePoint - Current mouse position in SVG coordinates
   */
  startDrag(element: BPMNElement, mousePoint: Point): void {
    this.dragState.isDragging = true;
    this.dragState.element = element;
    this.dragState.offset = {
      x: mousePoint.x - element.x,
      y: mousePoint.y - element.y
    };
    this.dragState.originalPosition = { x: element.x, y: element.y };
    
    // Create shadow at original position
    this.createDragShadow(element);
    
    // Make the actual element semi-transparent and bring it to front
    this.originalElementGroup = this.svg.querySelector(`[data-element-id="${element.id}"]`) as SVGGElement;
    if (this.originalElementGroup) {
      this.originalElementGroup.style.opacity = '0.6';
      // Move element to front so it appears above connections
      this.renderer.getMainGroup().appendChild(this.originalElementGroup);
    }
  }

  /**
   * Updates element position during drag
   * Provides free movement without snapping, shows visual guides only
   * @param mousePoint - Current mouse position in SVG coordinates
   */
  updateDrag(mousePoint: Point): void {
    if (!this.dragState.isDragging || !this.dragState.element) return;
    
    // Calculate new position - FREE MOVEMENT, NO SNAPPING
    const newX = mousePoint.x - this.dragState.offset.x;
    const newY = mousePoint.y - this.dragState.offset.y;
    const elementCenter = {
      x: newX + this.dragState.element.width / 2,
      y: newY + this.dragState.element.height / 2
    };
    
    // Check if hovering over a connection (highest priority)
    const hoveredConnection = this.connectionInsertHandler.checkConnectionProximity(
      elementCenter,
      this.dragState.element.type
    );
    
    if (hoveredConnection) {
      // Highlight the connection
      if (this.highlightedConnection !== hoveredConnection) {
        this.connectionInsertHandler.clearHighlight();
        this.connectionInsertHandler.highlightConnection(hoveredConnection);
        this.highlightedConnection = hoveredConnection;
      }
      // Hide other indicators
      this.hideInjectionIndicator();
      this.alignmentGuides.hideGuides();
    } else {
      // Clear connection highlight if any
      if (this.highlightedConnection) {
        this.connectionInsertHandler.clearHighlight();
        this.highlightedConnection = null;
      }
      
      // Check for injection between elements
      const injectionPosition = this.checkForInjection(
        this.dragState.element,
        newX,
        newY
      );
      
      if (injectionPosition) {
        // Show the injection indicator
        this.showInjectionIndicator(injectionPosition);
        // Hide alignment guides when showing injection
        this.alignmentGuides.hideGuides();
      } else {
        // Hide injection indicator
        this.hideInjectionIndicator();
        // Show alignment guides (visual only, no effect on position)
        this.alignmentGuides.showGuides(
          this.dragState.element,
          newX,
          newY
        );
      }
    }
    
    // Update element position with FREE MOVEMENT
    this.elementManager.updateElement(this.dragState.element.id, {
      x: newX,
      y: newY
    });
    
    // Update connections to follow the element
    this.updateConnectionsForElement(this.dragState.element.id);
  }

  /**
   * Completes the drag operation
   * Handles smart injection if applicable and records undo/redo command
   */
  endDrag(): void {
    if (this.dragState.isDragging && this.dragState.element && this.dragState.originalPosition) {
      const currentX = this.dragState.element.x;
      const currentY = this.dragState.element.y;
      
      // Check if dropping on a connection
      if (this.highlightedConnection) {
        const elementCenter = {
          x: currentX + this.dragState.element.width / 2,
          y: currentY + this.dragState.element.height / 2
        };
        
        // Insert the element on the connection
        const connection = this.connectionManager.getConnection(this.highlightedConnection);
        if (connection) {
          // Delete old connection
          this.connectionManager.deleteConnection(this.highlightedConnection);
          
          // Create two new connections
          const conn1Id = this.connectionManager.addConnection(connection.source, this.dragState.element.id);
          const conn2Id = this.connectionManager.addConnection(this.dragState.element.id, connection.target);
          
          // Update waypoints for new connections
          const conn1 = this.connectionManager.getConnection(conn1Id);
          const conn2 = this.connectionManager.getConnection(conn2Id);
          const source = this.elementManager.getElement(connection.source);
          const target = this.elementManager.getElement(connection.target);
          
          if (conn1 && source) {
            this.connectionManager.updateConnectionWaypoints(conn1, source, this.dragState.element);
          }
          
          if (conn2 && target) {
            this.connectionManager.updateConnectionWaypoints(conn2, this.dragState.element, target);
          }
        }
        
        // Clear connection highlight
        this.connectionInsertHandler.clearHighlight();
        this.highlightedConnection = null;
      } else {
        // Check if we should inject the element between others
        const injectionPosition = this.checkForInjection(
          this.dragState.element,
          currentX,
          currentY
        );
        
        if (injectionPosition && injectionPosition.pushElements && injectionPosition.pushDirection) {
          // Apply injection positioning on drop
          this.elementManager.updateElement(this.dragState.element.id, {
            x: injectionPosition.x,
            y: injectionPosition.y
          });
          
          // Push other elements aside to make room
          this.pushElementsAside(injectionPosition.pushElements, injectionPosition.pushDirection, this.dragState.element);
        }
      }
      
      // Create move command for undo/redo if position changed
      const finalX = this.dragState.element.x;
      const finalY = this.dragState.element.y;
      const origX = this.dragState.originalPosition.x;
      const origY = this.dragState.originalPosition.y;
      
      if (this.undoRedoManager && (finalX !== origX || finalY !== origY)) {
        const command = this.undoRedoManager.createMoveElementCommand(
          this.dragState.element.id,
          finalX,
          finalY,
          origX,
          origY
        );
        // Don't execute, just push to stack since move already happened
        this.undoRedoManager.pushCommand(command);
      }
      
      // Restore element opacity
      if (this.originalElementGroup) {
        this.originalElementGroup.style.opacity = '1';
        this.originalElementGroup = null;
      }
      
      // Clean up all visual indicators
      this.removeDragShadow();
      this.hideInjectionIndicator();
      this.alignmentGuides.hideGuides();
      if (this.highlightedConnection) {
        this.connectionInsertHandler.clearHighlight();
        this.highlightedConnection = null;
      }
      
      this.dragState.isDragging = false;
      this.dragState.element = null;
      this.dragState.originalPosition = null;
      this.onDragEnd();
    }
  }

  /**
   * Check if currently dragging an element
   * @returns true if dragging is in progress
   */
  isDragging(): boolean {
    return this.dragState.isDragging;
  }
  
  /**
   * Cancel the current drag operation and restore element to original position
   */
  cancelDrag(): void {
    if (this.dragState.isDragging && this.dragState.element && this.dragState.originalPosition) {
      const elementId = this.dragState.element.id;
      
      // Restore element to original position
      this.elementManager.updateElement(elementId, {
        x: this.dragState.originalPosition.x,
        y: this.dragState.originalPosition.y
      });
      
      // Update connections to original position
      this.updateConnectionsForElement(elementId);
      
      // Restore element opacity
      if (this.originalElementGroup) {
        this.originalElementGroup.style.opacity = '1';
        this.originalElementGroup = null;
      }
      
      // Clean up all visual indicators
      this.removeDragShadow();
      this.hideInjectionIndicator();
      this.alignmentGuides.hideGuides();
      if (this.highlightedConnection) {
        this.connectionInsertHandler.clearHighlight();
        this.highlightedConnection = null;
      }
      
      this.dragState.isDragging = false;
      this.dragState.element = null;
      this.dragState.originalPosition = null;
      this.onDragEnd();
    }
  }

  /**
   * Creates a semi-transparent shadow of the element at its original position
   * @param element - The element being dragged
   */
  private createDragShadow(element: BPMNElement): void {
    if (!this.dragState.originalPosition) return;
    
    const shadowGroup = this.createSVGElement('g') as SVGGElement;
    shadowGroup.setAttribute('class', 'drag-shadow');
    shadowGroup.style.opacity = '0.5';
    shadowGroup.style.pointerEvents = 'none';
    
    // Create shadow element
    const shadowElement = { ...element, x: this.dragState.originalPosition.x, y: this.dragState.originalPosition.y };
    this.renderShadowElement(shadowElement, shadowGroup);
    
    // Create shadow connections
    this.dragState.shadowConnections = [];
    const connections = this.connectionManager.getConnectionsForElement(element.id);
    
    connections.forEach(connection => {
      const shadowPath = this.createShadowConnection(connection, element);
      if (shadowPath) {
        this.dragState.shadowConnections.push(shadowPath);
        this.renderer.getMainGroup().appendChild(shadowPath);
      }
    });
    
    this.dragState.shadowGroup = shadowGroup;
    this.renderer.getMainGroup().appendChild(shadowGroup);
  }

  private renderShadowElement(element: BPMNElement, group: SVGGElement): void {
    if (element.type.includes('Event')) {
      const circle = this.createSVGElement('circle');
      circle.setAttribute('cx', String(element.x + element.width / 2));
      circle.setAttribute('cy', String(element.y + element.height / 2));
      circle.setAttribute('r', String(element.width / 2));
      circle.setAttribute('fill', '#ccc');
      circle.setAttribute('stroke', '#666');
      circle.setAttribute('stroke-width', element.type === 'endEvent' ? '4' : '2');
      circle.setAttribute('stroke-dasharray', '5,5');
      group.appendChild(circle);
    } else if (element.type.includes('Gateway')) {
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      const points = `${cx},${element.y} ${element.x + element.width},${cy} ${cx},${element.y + element.height} ${element.x},${cy}`;
      const polygon = this.createSVGElement('polygon');
      polygon.setAttribute('points', points);
      polygon.setAttribute('fill', '#ccc');
      polygon.setAttribute('stroke', '#666');
      polygon.setAttribute('stroke-width', '2');
      polygon.setAttribute('stroke-dasharray', '5,5');
      group.appendChild(polygon);
    } else {
      const rect = this.createSVGElement('rect');
      rect.setAttribute('x', String(element.x));
      rect.setAttribute('y', String(element.y));
      rect.setAttribute('width', String(element.width));
      rect.setAttribute('height', String(element.height));
      rect.setAttribute('rx', '5');
      rect.setAttribute('fill', '#ccc');
      rect.setAttribute('stroke', '#666');
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('stroke-dasharray', '5,5');
      group.appendChild(rect);
    }
  }

  private createShadowConnection(connection: Connection, draggedElement: BPMNElement): SVGPathElement | null {
    const source = this.elementManager.getElement(connection.source);
    const target = this.elementManager.getElement(connection.target);
    
    if (!source || !target || !this.dragState.originalPosition) return null;
    
    // Calculate waypoints for shadow connection
    let shadowSource = source;
    let shadowTarget = target;
    
    if (connection.source === draggedElement.id) {
      shadowSource = { ...source, x: this.dragState.originalPosition.x, y: this.dragState.originalPosition.y };
    } else {
      shadowTarget = { ...target, x: this.dragState.originalPosition.x, y: this.dragState.originalPosition.y };
    }
    
    const sourcePoint = this.connectionManager.getConnectionPoint(shadowSource, shadowTarget);
    const targetPoint = this.connectionManager.getConnectionPoint(shadowTarget, shadowSource);
    
    // Create shadow connection path
    const path = this.createSVGElement('path') as SVGPathElement;
    path.setAttribute('d', `M ${sourcePoint.x} ${sourcePoint.y} L ${targetPoint.x} ${targetPoint.y}`);
    path.setAttribute('stroke', '#999');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-dasharray', '5,5');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrowhead)');
    path.style.opacity = '0.3';
    path.style.pointerEvents = 'none';
    
    return path;
  }

  /**
   * Removes the shadow element and connections from the DOM
   */
  private removeDragShadow(): void {
    if (this.dragState.shadowGroup) {
      this.dragState.shadowGroup.remove();
      this.dragState.shadowGroup = null;
    }
    
    this.dragState.shadowConnections.forEach(conn => conn.remove());
    this.dragState.shadowConnections = [];
  }

  private createSVGElement(type: string): SVGElement {
    return document.createElementNS('http://www.w3.org/2000/svg', type);
  }

  private updateConnectionsForElement(elementId: string): void {
    const connections = this.connectionManager.getConnectionsForElement(elementId);
    connections.forEach(connection => {
      const source = this.elementManager.getElement(connection.source);
      const target = this.elementManager.getElement(connection.target);
      if (source && target) {
        this.connectionManager.updateConnectionWaypoints(connection, source, target);
        
        // Update waypoint handles if this connection is selected
        const connectionEditor = (this as any).connectionEditor;
        if (connectionEditor && connectionEditor.getSelectedConnection() === connection.id) {
          connectionEditor.updateWaypointHandles(connection);
        }
      }
    });
  }

  maintainShadow(): void {
    if (this.dragState.shadowGroup) {
      this.renderer.getMainGroup().appendChild(this.dragState.shadowGroup);
    }
    this.dragState.shadowConnections.forEach(conn => {
      this.renderer.getMainGroup().insertBefore(conn, this.dragState.shadowGroup);
    });
  }
  
  private checkCollision(
    draggedId: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): BPMNElement | null {
    const elements = this.elementManager.getAllElements();
    
    for (const element of elements) {
      if (element.id === draggedId) continue;
      
      // Check if rectangles overlap
      if (
        x < element.x + element.width &&
        x + width > element.x &&
        y < element.y + element.height &&
        y + height > element.y
      ) {
        return element;
      }
    }
    
    return null;
  }
  
  private findNonOverlappingPosition(
    draggedElement: BPMNElement,
    targetX: number,
    targetY: number,
    collidingElement: BPMNElement
  ): Point {
    // Calculate push direction based on centers
    const draggedCenterX = targetX + draggedElement.width / 2;
    const draggedCenterY = targetY + draggedElement.height / 2;
    const collidingCenterX = collidingElement.x + collidingElement.width / 2;
    const collidingCenterY = collidingElement.y + collidingElement.height / 2;
    
    const dx = draggedCenterX - collidingCenterX;
    const dy = draggedCenterY - collidingCenterY;
    
    // Snap to edge with minimum spacing
    const spacing = 10;
    let snapX = targetX;
    let snapY = targetY;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal snap
      if (dx > 0) {
        snapX = collidingElement.x + collidingElement.width + spacing;
      } else {
        snapX = collidingElement.x - draggedElement.width - spacing;
      }
    } else {
      // Vertical snap
      if (dy > 0) {
        snapY = collidingElement.y + collidingElement.height + spacing;
      } else {
        snapY = collidingElement.y - draggedElement.height - spacing;
      }
    }
    
    return { x: snapX, y: snapY };
  }
  
  private checkForInjection(
    draggedElement: BPMNElement,
    x: number,
    y: number
  ): { x: number; y: number; pushElements?: BPMNElement[]; pushDirection?: 'horizontal' | 'vertical' } | null {
    const elements = this.elementManager.getAllElements().filter(el => el.id !== draggedElement.id);
    const centerX = x + draggedElement.width / 2;
    const centerY = y + draggedElement.height / 2;
    
    // Increased thresholds for better detection
    const alignmentThreshold = 60; // How close elements need to be aligned
    const betweenThreshold = 100; // How close to be considered "between" elements
    
    // Find potential neighbors for horizontal injection
    let bestHorizontalMatch: { left: BPMNElement; right: BPMNElement; score: number } | null = null;
    let bestVerticalMatch: { top: BPMNElement; bottom: BPMNElement; score: number } | null = null;
    
    // Check all pairs of elements for injection opportunities
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const elem1 = elements[i];
        const elem2 = elements[j];
        
        const elem1CenterX = elem1.x + elem1.width / 2;
        const elem1CenterY = elem1.y + elem1.height / 2;
        const elem2CenterX = elem2.x + elem2.width / 2;
        const elem2CenterY = elem2.y + elem2.height / 2;
        
        // Check for horizontal alignment (elements side by side)
        const yAlignment = Math.abs(elem1CenterY - elem2CenterY);
        if (yAlignment < alignmentThreshold) {
          // Check if dragged element is vertically aligned and between them
          const dragYAlignment = Math.abs(centerY - elem1CenterY);
          if (dragYAlignment < alignmentThreshold) {
            const left = elem1.x < elem2.x ? elem1 : elem2;
            const right = elem1.x < elem2.x ? elem2 : elem1;
            
            // Check if dragged element is between them horizontally
            if (centerX > left.x + left.width - betweenThreshold && 
                centerX < right.x + betweenThreshold) {
              const score = yAlignment + dragYAlignment; // Lower is better
              if (!bestHorizontalMatch || score < bestHorizontalMatch.score) {
                bestHorizontalMatch = { left, right, score };
              }
            }
          }
        }
        
        // Check for vertical alignment (elements stacked)
        const xAlignment = Math.abs(elem1CenterX - elem2CenterX);
        if (xAlignment < alignmentThreshold) {
          // Check if dragged element is horizontally aligned and between them
          const dragXAlignment = Math.abs(centerX - elem1CenterX);
          if (dragXAlignment < alignmentThreshold) {
            const top = elem1.y < elem2.y ? elem1 : elem2;
            const bottom = elem1.y < elem2.y ? elem2 : elem1;
            
            // Check if dragged element is between them vertically
            if (centerY > top.y + top.height - betweenThreshold && 
                centerY < bottom.y + betweenThreshold) {
              const score = xAlignment + dragXAlignment; // Lower is better
              if (!bestVerticalMatch || score < bestVerticalMatch.score) {
                bestVerticalMatch = { top, bottom, score };
              }
            }
          }
        }
      }
    }
    
    // Prioritize horizontal match over vertical if both exist
    if (bestHorizontalMatch) {
      const { left, right } = bestHorizontalMatch;
      const gap = right.x - (left.x + left.width);
      const requiredSpace = draggedElement.width + 20;
      
      if (gap < requiredSpace) {
        // Need to push elements
        const injectionX = left.x + left.width + 10;
        const injectionY = left.y + (left.height - draggedElement.height) / 2;
        
        const elementsToPush = elements.filter(el => el.x >= right.x);
        
        return {
          x: injectionX,
          y: injectionY,
          pushElements: elementsToPush,
          pushDirection: 'horizontal' as const
        };
      } else {
        // Enough space
        const injectionX = left.x + left.width + (gap - draggedElement.width) / 2;
        const injectionY = left.y + (left.height - draggedElement.height) / 2;
        return { x: injectionX, y: injectionY };
      }
    }
    
    // Check vertical match if no horizontal match
    if (bestVerticalMatch) {
      const { top, bottom } = bestVerticalMatch;
      const gap = bottom.y - (top.y + top.height);
      const requiredSpace = draggedElement.height + 20;
      
      if (gap < requiredSpace) {
        // Need to push elements
        const injectionX = top.x + (top.width - draggedElement.width) / 2;
        const injectionY = top.y + top.height + 10;
        
        const elementsToPush = elements.filter(el => el.y >= bottom.y);
        
        return {
          x: injectionX,
          y: injectionY,
          pushElements: elementsToPush,
          pushDirection: 'vertical' as const
        };
      } else {
        // Enough space
        const injectionX = top.x + (top.width - draggedElement.width) / 2;
        const injectionY = top.y + top.height + (gap - draggedElement.height) / 2;
        return { x: injectionX, y: injectionY };
      }
    }
    
    return null;
  }
  
  /**
   * Shows a prominent green indicator where element will be injected
   */
  private showInjectionIndicator(position: { x: number; y: number }): void {
    if (!this.injectionIndicator) {
      this.injectionIndicator = this.createSVGElement('rect') as SVGRectElement;
      this.injectionIndicator.setAttribute('fill', '#4caf50');
      this.injectionIndicator.setAttribute('fill-opacity', '0.4');
      this.injectionIndicator.setAttribute('stroke', '#2e7d32');
      this.injectionIndicator.setAttribute('stroke-width', '3');
      this.injectionIndicator.setAttribute('stroke-dasharray', '10,5');
      this.injectionIndicator.style.pointerEvents = 'none';
    }
    
    if (this.dragState.element) {
      this.injectionIndicator.setAttribute('x', String(position.x));
      this.injectionIndicator.setAttribute('y', String(position.y));
      this.injectionIndicator.setAttribute('width', String(this.dragState.element.width));
      this.injectionIndicator.setAttribute('height', String(this.dragState.element.height));
      this.injectionIndicator.setAttribute('rx', '5');
      
      if (!this.injectionIndicator.parentNode) {
        this.renderer.getMainGroup().appendChild(this.injectionIndicator);
      }
    }
  }
  
  /**
   * Hides the injection indicator
   */
  private hideInjectionIndicator(): void {
    if (this.injectionIndicator && this.injectionIndicator.parentNode) {
      this.injectionIndicator.remove();
    }
  }
  
  /**
   * Pushes elements aside to make room for injection
   */
  private pushElementsAside(elements: BPMNElement[], direction: 'horizontal' | 'vertical', draggedElement: BPMNElement): void {
    const pushDistance = direction === 'horizontal' 
      ? draggedElement.width + 20 
      : draggedElement.height + 20;
    
    elements.forEach(element => {
      const newPosition = direction === 'horizontal'
        ? { x: element.x + pushDistance, y: element.y }
        : { x: element.x, y: element.y + pushDistance };
      
      // Animate the push for smooth UX
      this.elementManager.updateElement(element.id, newPosition);
      
      // Update connections for pushed elements
      this.updateConnectionsForElement(element.id);
    });
  }
}
