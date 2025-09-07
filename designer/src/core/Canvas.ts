// Canvas class for managing SVG rendering and viewport

import { EventBus } from './EventBus';
import { Bounds, Point } from '../types';

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class Canvas {
  private container: HTMLElement;
  private svg: SVGSVGElement;
  private viewport: SVGGElement;
  private rootGroup: SVGGElement;
  private viewBox: ViewBox;
  private eventBus: EventBus;
  private zoom: number = 1;

  constructor(container: HTMLElement | string, eventBus: EventBus) {
    this.eventBus = eventBus;
    
    if (typeof container === 'string') {
      const element = document.querySelector(container) as HTMLElement;
      if (!element) {
        throw new Error(`Container ${container} not found`);
      }
      this.container = element;
    } else {
      this.container = container;
    }

    this.viewBox = { x: 0, y: 0, width: 1000, height: 1000 };
    this.svg = this.createSVG();
    this.viewport = this.createViewport();
    this.rootGroup = this.createRootGroup();
    
    this.init();
  }

  private createSVG(): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.display = 'block';
    return svg;
  }

  private createViewport(): SVGGElement {
    const viewport = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    viewport.setAttribute('class', 'viewport');
    return viewport;
  }

  private createRootGroup(): SVGGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'root-group');
    return group;
  }

  private init(): void {
    // Create defs for markers, patterns, etc.
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    this.createMarkers(defs);
    this.svg.appendChild(defs);

    // Build the hierarchy
    this.viewport.appendChild(this.rootGroup);
    this.svg.appendChild(this.viewport);
    this.container.appendChild(this.svg);

    // Set initial viewBox
    this.updateViewBox();
    
    // Setup event listeners
    this.setupEventListeners();
  }

  private createMarkers(defs: SVGDefsElement): void {
    // Arrow marker for sequence flows
    const arrowMarker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    arrowMarker.setAttribute('id', 'arrow-marker');
    arrowMarker.setAttribute('markerWidth', '10');
    arrowMarker.setAttribute('markerHeight', '10');
    arrowMarker.setAttribute('refX', '10');
    arrowMarker.setAttribute('refY', '5');
    arrowMarker.setAttribute('orient', 'auto');
    arrowMarker.setAttribute('markerUnits', 'strokeWidth');

    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    arrowPath.setAttribute('fill', '#000');
    arrowMarker.appendChild(arrowPath);
    defs.appendChild(arrowMarker);

    // Diamond marker for gateways
    const diamondMarker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    diamondMarker.setAttribute('id', 'diamond-marker');
    diamondMarker.setAttribute('markerWidth', '10');
    diamondMarker.setAttribute('markerHeight', '10');
    diamondMarker.setAttribute('refX', '5');
    diamondMarker.setAttribute('refY', '5');
    diamondMarker.setAttribute('orient', 'auto');

    const diamondPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    diamondPath.setAttribute('d', 'M 5 0 L 10 5 L 5 10 L 0 5 z');
    diamondPath.setAttribute('fill', '#fff');
    diamondPath.setAttribute('stroke', '#000');
    diamondMarker.appendChild(diamondPath);
    defs.appendChild(diamondMarker);
  }

  private setupEventListeners(): void {
    // Mouse wheel for zoom
    this.svg.addEventListener('wheel', (e) => this.handleWheel(e));
    
    // Mouse events for panning
    let isPanning = false;
    let startPoint: Point = { x: 0, y: 0 };
    let startViewBox: ViewBox = { ...this.viewBox };

    this.svg.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (e.button === 0 && e.ctrlKey)) { // Middle button or Ctrl+Left
        isPanning = true;
        startPoint = { x: e.clientX, y: e.clientY };
        startViewBox = { ...this.viewBox };
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (isPanning) {
        const dx = (e.clientX - startPoint.x) / this.zoom;
        const dy = (e.clientY - startPoint.y) / this.zoom;
        this.viewBox.x = startViewBox.x - dx;
        this.viewBox.y = startViewBox.y - dy;
        this.updateViewBox();
      }
    });

    window.addEventListener('mouseup', () => {
      isPanning = false;
    });
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, this.zoom * delta));
    
    // Calculate mouse position relative to SVG
    const rect = this.svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate the point in SVG coordinates
    const svgX = this.viewBox.x + (mouseX / rect.width) * this.viewBox.width;
    const svgY = this.viewBox.y + (mouseY / rect.height) * this.viewBox.height;
    
    // Update zoom
    const zoomRatio = newZoom / this.zoom;
    this.zoom = newZoom;
    
    // Adjust viewBox to zoom towards mouse position
    this.viewBox.width = this.viewBox.width / zoomRatio;
    this.viewBox.height = this.viewBox.height / zoomRatio;
    this.viewBox.x = svgX - (mouseX / rect.width) * this.viewBox.width;
    this.viewBox.y = svgY - (mouseY / rect.height) * this.viewBox.height;
    
    this.updateViewBox();
    this.eventBus.emit('canvas.zoom', { zoom: this.zoom });
  }

  private updateViewBox(): void {
    this.svg.setAttribute('viewBox', 
      `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`);
  }

  public getRootGroup(): SVGGElement {
    return this.rootGroup;
  }

  public getSVG(): SVGSVGElement {
    return this.svg;
  }

  public getZoom(): number {
    return this.zoom;
  }

  public setZoom(zoom: number): void {
    this.zoom = Math.max(0.1, Math.min(5, zoom));
    const center = {
      x: this.viewBox.x + this.viewBox.width / 2,
      y: this.viewBox.y + this.viewBox.height / 2
    };
    
    this.viewBox.width = 1000 / this.zoom;
    this.viewBox.height = 1000 / this.zoom;
    this.viewBox.x = center.x - this.viewBox.width / 2;
    this.viewBox.y = center.y - this.viewBox.height / 2;
    
    this.updateViewBox();
    this.eventBus.emit('canvas.zoom', { zoom: this.zoom });
  }

  public centerView(bounds?: Bounds): void {
    if (bounds) {
      this.viewBox.x = bounds.x - 50;
      this.viewBox.y = bounds.y - 50;
      this.viewBox.width = bounds.width + 100;
      this.viewBox.height = bounds.height + 100;
    } else {
      // Center on origin
      this.viewBox = { x: -500, y: -500, width: 1000, height: 1000 };
    }
    this.updateViewBox();
  }

  public screenToSVG(screenPoint: Point): Point {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: this.viewBox.x + (screenPoint.x - rect.left) / rect.width * this.viewBox.width,
      y: this.viewBox.y + (screenPoint.y - rect.top) / rect.height * this.viewBox.height
    };
  }

  public svgToScreen(svgPoint: Point): Point {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: rect.left + ((svgPoint.x - this.viewBox.x) / this.viewBox.width) * rect.width,
      y: rect.top + ((svgPoint.y - this.viewBox.y) / this.viewBox.height) * rect.height
    };
  }

  public clear(): void {
    while (this.rootGroup.firstChild) {
      this.rootGroup.removeChild(this.rootGroup.firstChild);
    }
  }

  public destroy(): void {
    this.clear();
    this.container.removeChild(this.svg);
  }
}
