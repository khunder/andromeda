import { BPMNElement, Connection } from './types';
import { ElementManager } from './ElementManager';
import { ConnectionManager } from './ConnectionManager';

interface Command {
  execute(): void;
  undo(): void;
  description: string;
}

export class UndoRedoManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxStackSize = 50;
  
  constructor(
    private elementManager: ElementManager,
    private connectionManager: ConnectionManager,
    private onUpdate: () => void
  ) {}
  
  executeCommand(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack on new command
    
    // Limit stack size
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
    
    this.onUpdate();
  }
  
  // Push a command to the stack without executing it (for already completed actions)
  pushCommand(command: Command): void {
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack on new command
    
    // Limit stack size
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
  }
  
  undo(): void {
    const command = this.undoStack.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);
      this.onUpdate();
    }
  }
  
  redo(): void {
    const command = this.redoStack.pop();
    if (command) {
      command.execute();
      this.undoStack.push(command);
      this.onUpdate();
    }
  }
  
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
  
  // Command implementations
  createAddElementCommand(type: string, x: number, y: number): Command {
    let elementId: string | null = null;
    let elementData: BPMNElement | null = null;
    
    return {
      execute: () => {
        elementId = this.elementManager.addElement(type, x, y);
        elementData = this.elementManager.getElement(elementId) || null;
      },
      undo: () => {
        if (elementId) {
          // Remove connections first
          this.connectionManager.deleteConnectionsForElement(elementId);
          this.elementManager.deleteElement(elementId);
        }
      },
      description: `Add ${type}`
    };
  }
  
  // Create add element command with specific ID
  createAddElementCommandWithId(type: string, x: number, y: number, id: string): Command {
    let elementData: BPMNElement | null = null;
    
    return {
      execute: () => {
        this.elementManager.addElement(type, x, y, id);
        elementData = this.elementManager.getElement(id) || null;
      },
      undo: () => {
        // Remove connections first
        this.connectionManager.deleteConnectionsForElement(id);
        this.elementManager.deleteElement(id);
      },
      description: `Add ${type}`
    };
  }
  
  createDeleteElementCommand(elementId: string): Command {
    const element = this.elementManager.getElement(elementId);
    const connections = this.connectionManager.getConnectionsForElement(elementId);
    
    if (!element) {
      throw new Error('Element not found');
    }
    
    return {
      execute: () => {
        this.connectionManager.deleteConnectionsForElement(elementId);
        this.elementManager.deleteElement(elementId);
      },
      undo: () => {
        // Restore element
        const restoredId = this.elementManager.addElement(element.type, element.x, element.y);
        const restoredElement = this.elementManager.getElement(restoredId);
        if (restoredElement) {
          // Restore properties
          Object.assign(restoredElement, element);
          restoredElement.id = restoredId; // Keep new ID
          
          // Note: Connection restoration would need ID mapping
          // For simplicity, connections are not restored in this version
        }
      },
      description: `Delete ${element.type}`
    };
  }
  
  createMoveElementCommand(elementId: string, newX: number, newY: number, oldX?: number, oldY?: number): Command {
    const element = this.elementManager.getElement(elementId);
    if (!element) {
      throw new Error('Element not found');
    }
    
    // Use provided old position or current position
    const prevX = oldX !== undefined ? oldX : element.x;
    const prevY = oldY !== undefined ? oldY : element.y;
    
    return {
      execute: () => {
        this.elementManager.updateElement(elementId, { x: newX, y: newY });
        // Update connections for the moved element
        this.updateConnectionsForElement(elementId);
        this.onUpdate();
      },
      undo: () => {
        this.elementManager.updateElement(elementId, { x: prevX, y: prevY });
        // Update connections for the moved element
        this.updateConnectionsForElement(elementId);
        this.onUpdate();
      },
      description: `Move ${element.type}`
    };
  }
  
  private updateConnectionsForElement(elementId: string): void {
    const connections = this.connectionManager.getConnectionsForElement(elementId);
    connections.forEach(connection => {
      const source = this.elementManager.getElement(connection.source);
      const target = this.elementManager.getElement(connection.target);
      if (source && target) {
        this.connectionManager.updateConnectionWaypoints(connection, source, target);
      }
    });
  }
  
  createAddConnectionCommand(sourceId: string, targetId: string): Command {
    let connectionId: string | null = null;
    
    return {
      execute: () => {
        connectionId = this.connectionManager.addConnection(sourceId, targetId);
        const connection = this.connectionManager.getConnection(connectionId);
        const source = this.elementManager.getElement(sourceId);
        const target = this.elementManager.getElement(targetId);
        if (connection && source && target) {
          this.connectionManager.updateConnectionWaypoints(connection, source, target);
        }
      },
      undo: () => {
        if (connectionId) {
          this.connectionManager.deleteConnection(connectionId);
        }
      },
      description: 'Add connection'
    };
  }
  
  // Create add connection command with specific ID
  createAddConnectionCommandWithId(sourceId: string, targetId: string, id: string): Command {
    return {
      execute: () => {
        this.connectionManager.addConnection(sourceId, targetId, id);
        const connection = this.connectionManager.getConnection(id);
        const source = this.elementManager.getElement(sourceId);
        const target = this.elementManager.getElement(targetId);
        if (connection && source && target) {
          this.connectionManager.updateConnectionWaypoints(connection, source, target);
        }
      },
      undo: () => {
        this.connectionManager.deleteConnection(id);
      },
      description: 'Add connection'
    };
  }
  
  createDeleteConnectionCommand(connectionId: string): Command {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }
    
    const sourceId = connection.source;
    const targetId = connection.target;
    const waypoints = [...connection.waypoints];
    
    return {
      execute: () => {
        this.connectionManager.deleteConnection(connectionId);
      },
      undo: () => {
        const newId = this.connectionManager.addConnection(sourceId, targetId);
        const newConnection = this.connectionManager.getConnection(newId);
        if (newConnection) {
          newConnection.waypoints = waypoints;
        }
      },
      description: 'Delete connection'
    };
  }
}
