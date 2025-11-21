/**
 * BPMN Model Manager
 * Maintains a unified BPMN model that preserves IDs and ensures consistency
 * between designer and XML editor views
 */

import { BPMNElement, Connection } from './types';

export interface BPMNModel {
  definitionsId: string;
  processId: string;
  elements: Map<string, BPMNElement>;
  connections: Map<string, Connection>;
  isDirty: boolean;
}

export class BPMNModelManager {
  private static instance: BPMNModelManager;
  private model: BPMNModel;
  private listeners: Set<(model: BPMNModel) => void> = new Set();

  private constructor() {
    this.model = this.createEmptyModel();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): BPMNModelManager {
    if (!BPMNModelManager.instance) {
      BPMNModelManager.instance = new BPMNModelManager();
    }
    return BPMNModelManager.instance;
  }

  /**
   * Create an empty model with stable IDs
   */
  private createEmptyModel(): BPMNModel {
    return {
      definitionsId: this.getOrCreateDefinitionsId(),
      processId: this.getOrCreateProcessId(),
      elements: new Map(),
      connections: new Map(),
      isDirty: false
    };
  }

  /**
   * Get or create a stable definitions ID
   */
  private getOrCreateDefinitionsId(): string {
    const stored = localStorage.getItem('bpmn_definitions_id');
    if (stored) return stored;
    
    const id = `Definitions_${this.generateStableId()}`;
    localStorage.setItem('bpmn_definitions_id', id);
    return id;
  }

  /**
   * Get or create a stable process ID
   */
  private getOrCreateProcessId(): string {
    const stored = localStorage.getItem('bpmn_process_id');
    if (stored) return stored;
    
    const id = `Process_${this.generateStableId()}`;
    localStorage.setItem('bpmn_process_id', id);
    return id;
  }

  /**
   * Generate a stable ID (not random)
   */
  private generateStableId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.floor(Math.random() * 1000).toString(36);
    return `${timestamp}_${random}`;
  }

  /**
   * Get the current model
   */
  getModel(): BPMNModel {
    return this.model;
  }

  /**
   * Add or update an element
   */
  setElement(element: BPMNElement): void {
    // Preserve the element ID if it exists
    if (!element.id) {
      element.id = `${element.type}_${this.generateStableId()}`;
    }
    
    this.model.elements.set(element.id, { ...element });
    this.model.isDirty = true;
    this.notifyListeners();
  }

  /**
   * Remove an element
   */
  removeElement(elementId: string): void {
    this.model.elements.delete(elementId);
    
    // Remove connections associated with this element
    const connectionsToRemove: string[] = [];
    this.model.connections.forEach((connection, id) => {
      if (connection.source === elementId || connection.target === elementId) {
        connectionsToRemove.push(id);
      }
    });
    
    connectionsToRemove.forEach(id => this.model.connections.delete(id));
    
    this.model.isDirty = true;
    this.notifyListeners();
  }

  /**
   * Add or update a connection
   */
  setConnection(connection: Connection): void {
    // Preserve the connection ID if it exists
    if (!connection.id) {
      connection.id = `Flow_${this.generateStableId()}`;
    }
    
    this.model.connections.set(connection.id, { ...connection });
    this.model.isDirty = true;
    this.notifyListeners();
  }

  /**
   * Remove a connection
   */
  removeConnection(connectionId: string): void {
    this.model.connections.delete(connectionId);
    this.model.isDirty = true;
    this.notifyListeners();
  }

  /**
   * Update multiple elements at once (for imports)
   */
  setElements(elements: BPMNElement[]): void {
    this.model.elements.clear();
    elements.forEach(element => {
      this.model.elements.set(element.id, { ...element });
    });
    this.model.isDirty = true;
    this.notifyListeners();
  }

  /**
   * Update multiple connections at once (for imports)
   */
  setConnections(connections: Connection[]): void {
    this.model.connections.clear();
    connections.forEach(connection => {
      this.model.connections.set(connection.id, { ...connection });
    });
    this.model.isDirty = true;
    this.notifyListeners();
  }

  /**
   * Clear the model
   */
  clear(): void {
    this.model.elements.clear();
    this.model.connections.clear();
    this.model.isDirty = false;
    this.notifyListeners();
  }

  /**
   * Get all elements as array
   */
  getElements(): BPMNElement[] {
    return Array.from(this.model.elements.values());
  }

  /**
   * Get all connections as array
   */
  getConnections(): Connection[] {
    return Array.from(this.model.connections.values());
  }

  /**
   * Get element by ID
   */
  getElementById(id: string): BPMNElement | undefined {
    return this.model.elements.get(id);
  }

  /**
   * Get connection by ID
   */
  getConnectionById(id: string): Connection | undefined {
    return this.model.connections.get(id);
  }

  /**
   * Subscribe to model changes
   */
  subscribe(listener: (model: BPMNModel) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of model changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.model));
  }

  /**
   * Mark model as clean (saved)
   */
  markClean(): void {
    this.model.isDirty = false;
    this.notifyListeners();
  }

  /**
   * Check if model has unsaved changes
   */
  isDirty(): boolean {
    return this.model.isDirty;
  }

  /**
   * Update element position
   */
  updateElementPosition(elementId: string, x: number, y: number): void {
    const element = this.model.elements.get(elementId);
    if (element) {
      element.x = x;
      element.y = y;
      this.model.isDirty = true;
      this.notifyListeners();
    }
  }

  /**
   * Update element properties
   */
  updateElementProperties(elementId: string, properties: any): void {
    const element = this.model.elements.get(elementId);
    if (element) {
      element.properties = { ...element.properties, ...properties };
      this.model.isDirty = true;
      this.notifyListeners();
    }
  }

  /**
   * Update element label
   */
  updateElementLabel(elementId: string, label: string): void {
    const element = this.model.elements.get(elementId);
    if (element) {
      element.label = label;
      this.model.isDirty = true;
      this.notifyListeners();
    }
  }

  /**
   * Update connection waypoints
   */
  updateConnectionWaypoints(connectionId: string, waypoints: { x: number; y: number }[]): void {
    const connection = this.model.connections.get(connectionId);
    if (connection) {
      connection.waypoints = waypoints;
      this.model.isDirty = true;
      this.notifyListeners();
    }
  }

  /**
   * Set process and definitions IDs (for imports)
   */
  setModelIds(definitionsId?: string, processId?: string): void {
    if (definitionsId) {
      this.model.definitionsId = definitionsId;
      localStorage.setItem('bpmn_definitions_id', definitionsId);
    }
    if (processId) {
      this.model.processId = processId;
      localStorage.setItem('bpmn_process_id', processId);
    }
  }

  /**
   * Get model IDs
   */
  getModelIds(): { definitionsId: string; processId: string } {
    return {
      definitionsId: this.model.definitionsId,
      processId: this.model.processId
    };
  }
}