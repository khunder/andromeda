/**
 * Unified BPMN Model Store using bpmn-moddle
 * This maintains a single source of truth for the BPMN model
 * that both the designer and XML editor use
 */

import BpmnModdle from 'bpmn-moddle';

export class BPMNModdleStore {
  private static instance: BPMNModdleStore;
  private moddle: any;
  private definitions: any;
  private process: any;
  private diagram: any;
  private plane: any;
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.moddle = new BpmnModdle();
    this.initializeEmptyModel();
  }

  static getInstance(): BPMNModdleStore {
    if (!BPMNModdleStore.instance) {
      BPMNModdleStore.instance = new BPMNModdleStore();
    }
    return BPMNModdleStore.instance;
  }

  /**
   * Initialize with empty BPMN model
   */
  private initializeEmptyModel(): void {
    // Get or generate stable IDs
    const definitionsId = this.getOrCreateId('definitions');
    const processId = this.getOrCreateId('process');
    
    // Create root definitions with stable ID
    this.definitions = this.moddle.create('bpmn:Definitions', {
      id: definitionsId,
      targetNamespace: 'http://bpmn.io/schema/bpmn',
      'xmlns:bpmn': 'http://www.omg.org/spec/BPMN/20100524/MODEL',
      'xmlns:bpmndi': 'http://www.omg.org/spec/BPMN/20100524/DI',
      'xmlns:dc': 'http://www.omg.org/spec/DD/20100524/DC',
      'xmlns:di': 'http://www.omg.org/spec/DD/20100524/DI'
    });

    // Create process with stable ID
    this.process = this.moddle.create('bpmn:Process', {
      id: processId,
      isExecutable: true,
      flowElements: []
    });

    // Create diagram
    this.diagram = this.moddle.create('bpmndi:BPMNDiagram', {
      id: `BPMNDiagram_1`
    });

    // Create plane
    this.plane = this.moddle.create('bpmndi:BPMNPlane', {
      id: `BPMNPlane_1`,
      bpmnElement: this.process,
      planeElement: []
    });

    this.diagram.plane = this.plane;
    this.definitions.rootElements = [this.process];
    this.definitions.diagrams = [this.diagram];
  }

  /**
   * Get or create stable ID
   */
  private getOrCreateId(type: 'definitions' | 'process'): string {
    const key = `bpmn_${type}_id`;
    let id = sessionStorage.getItem(key);
    if (!id) {
      const prefix = type === 'definitions' ? 'Definitions' : 'Process';
      id = `${prefix}_${this.generateId()}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get the moddle instance
   */
  getModdle(): any {
    return this.moddle;
  }

  /**
   * Get current definitions
   */
  getDefinitions(): any {
    return this.definitions;
  }

  /**
   * Get current process
   */
  getProcess(): any {
    return this.process;
  }

  /**
   * Get diagram
   */
  getDiagram(): any {
    return this.diagram;
  }

  /**
   * Get plane
   */
  getPlane(): any {
    return this.plane;
  }

  /**
   * Load model from XML
   */
  async loadFromXML(xml: string): Promise<void> {
    try {
      const { rootElement } = await this.moddle.fromXML(xml);
      this.definitions = rootElement;
      
      // Override with stored IDs to maintain consistency
      const storedDefinitionsId = sessionStorage.getItem('bpmn_definitions_id');
      const storedProcessId = sessionStorage.getItem('bpmn_process_id');
      
      // If we have a stored definitions ID, use it
      if (storedDefinitionsId) {
        this.definitions.id = storedDefinitionsId;
      } else {
        // First time loading - generate and store the ID
        if (!this.definitions.id) {
          this.definitions.id = `Definitions_${this.generateId()}`;
        }
        sessionStorage.setItem('bpmn_definitions_id', this.definitions.id);
      }
      
      // Find process
      this.process = this.definitions.rootElements?.find((e: any) => e.$type === 'bpmn:Process');
      if (!this.process) {
        // Create process if not found
        this.process = this.moddle.create('bpmn:Process', {
          id: storedProcessId || this.getOrCreateId('process'),
          isExecutable: true,
          flowElements: []
        });
        this.definitions.rootElements = [this.process];
      } else {
        // Process exists - override its ID with stored one if available
        if (storedProcessId) {
          this.process.id = storedProcessId;
        } else {
          // First time loading - store the current ID
          sessionStorage.setItem('bpmn_process_id', this.process.id);
        }
      }

      // Find or create diagram
      this.diagram = this.definitions.diagrams?.[0];
      if (!this.diagram) {
        this.diagram = this.moddle.create('bpmndi:BPMNDiagram', {
          id: 'BPMNDiagram_1'
        });
        this.definitions.diagrams = [this.diagram];
      }

      // Get or create plane
      this.plane = this.diagram.plane;
      if (!this.plane) {
        this.plane = this.moddle.create('bpmndi:BPMNPlane', {
          id: 'BPMNPlane_1',
          bpmnElement: this.process,
          planeElement: []
        });
        this.diagram.plane = this.plane;
      } else {
        // Update plane's bpmnElement reference to use our process with stable ID
        this.plane.bpmnElement = this.process;
      }

      this.notifyListeners();
    } catch (error) {
      console.error('Error loading BPMN XML:', error);
      throw error;
    }
  }

  /**
   * Export model to XML
   */
  async toXML(format: boolean = true): Promise<string> {
    try {
      const { xml } = await this.moddle.toXML(this.definitions, { format });
      return xml;
    } catch (error) {
      console.error('Error exporting to XML:', error);
      throw error;
    }
  }

  /**
   * Add flow element (task, event, gateway)
   */
  addFlowElement(element: any, notify: boolean = true): void {
    if (!this.process.flowElements) {
      this.process.flowElements = [];
    }
    this.process.flowElements.push(element);
    if (notify) {
      this.notifyListeners();
    }
  }

  /**
   * Remove flow element
   */
  removeFlowElement(elementId: string): void {
    if (this.process.flowElements) {
      const index = this.process.flowElements.findIndex((e: any) => e.id === elementId);
      if (index >= 0) {
        this.process.flowElements.splice(index, 1);
        
        // Also remove associated sequence flows
        this.process.flowElements = this.process.flowElements.filter((e: any) => {
          if (e.$type === 'bpmn:SequenceFlow') {
            return e.sourceRef?.id !== elementId && e.targetRef?.id !== elementId;
          }
          return true;
        });
        
        this.notifyListeners();
      }
    }
  }

  /**
   * Get flow element by ID
   */
  getFlowElement(elementId: string): any {
    return this.process.flowElements?.find((e: any) => e.id === elementId);
  }

  /**
   * Update flow element
   */
  updateFlowElement(elementId: string, updates: any): void {
    const element = this.getFlowElement(elementId);
    if (element) {
      Object.assign(element, updates);
      this.notifyListeners();
    }
  }

  /**
   * Add shape to diagram
   */
  addShape(shape: any, notify: boolean = true): void {
    if (!this.plane.planeElement) {
      this.plane.planeElement = [];
    }
    this.plane.planeElement.push(shape);
    if (notify) {
      this.notifyListeners();
    }
  }

  /**
   * Remove shape from diagram
   */
  removeShape(elementId: string): void {
    if (this.plane.planeElement) {
      const index = this.plane.planeElement.findIndex(
        (s: any) => s.$type === 'bpmndi:BPMNShape' && s.bpmnElement?.id === elementId
      );
      if (index >= 0) {
        this.plane.planeElement.splice(index, 1);
        this.notifyListeners();
      }
    }
  }

  /**
   * Get shape by element ID
   */
  getShape(elementId: string): any {
    return this.plane.planeElement?.find(
      (s: any) => s.$type === 'bpmndi:BPMNShape' && s.bpmnElement?.id === elementId
    );
  }

  /**
   * Update shape bounds
   */
  updateShapeBounds(elementId: string, x: number, y: number, width: number, height: number): void {
    const shape = this.getShape(elementId);
    if (shape) {
      if (!shape.bounds) {
        shape.bounds = this.moddle.create('dc:Bounds');
      }
      shape.bounds.x = x;
      shape.bounds.y = y;
      shape.bounds.width = width;
      shape.bounds.height = height;
      this.notifyListeners();
    }
  }

  /**
   * Add edge to diagram
   */
  addEdge(edge: any, notify: boolean = true): void {
    if (!this.plane.planeElement) {
      this.plane.planeElement = [];
    }
    this.plane.planeElement.push(edge);
    if (notify) {
      this.notifyListeners();
    }
  }

  /**
   * Remove edge from diagram
   */
  removeEdge(flowId: string): void {
    if (this.plane.planeElement) {
      const index = this.plane.planeElement.findIndex(
        (e: any) => e.$type === 'bpmndi:BPMNEdge' && e.bpmnElement?.id === flowId
      );
      if (index >= 0) {
        this.plane.planeElement.splice(index, 1);
        this.notifyListeners();
      }
    }
  }

  /**
   * Get edge by flow ID
   */
  getEdge(flowId: string): any {
    return this.plane.planeElement?.find(
      (e: any) => e.$type === 'bpmndi:BPMNEdge' && e.bpmnElement?.id === flowId
    );
  }

  /**
   * Update edge waypoints
   */
  updateEdgeWaypoints(flowId: string, waypoints: { x: number; y: number }[]): void {
    const edge = this.getEdge(flowId);
    if (edge) {
      edge.waypoint = waypoints.map(wp => 
        this.moddle.create('dc:Point', { x: wp.x, y: wp.y })
      );
      this.notifyListeners();
    }
  }

  /**
   * Subscribe to model changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Clear the model
   */
  clear(): void {
    this.initializeEmptyModel();
    this.notifyListeners();
  }
  
  /**
   * Clear stored IDs from sessionStorage (for testing/reset)
   */
  clearStoredIds(): void {
    sessionStorage.removeItem('bpmn_definitions_id');
    sessionStorage.removeItem('bpmn_process_id');
  }

  /**
   * Get all flow elements
   */
  getAllFlowElements(): any[] {
    return this.process.flowElements || [];
  }

  /**
   * Get all shapes
   */
  getAllShapes(): any[] {
    return this.plane.planeElement?.filter((e: any) => e.$type === 'bpmndi:BPMNShape') || [];
  }

  /**
   * Get all edges
   */
  getAllEdges(): any[] {
    return this.plane.planeElement?.filter((e: any) => e.$type === 'bpmndi:BPMNEdge') || [];
  }
}