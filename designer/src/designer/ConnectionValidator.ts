import { BPMNElement } from './types';

export class ConnectionValidator {
  // Define connection rules based on BPMN specification
  private static readonly CONNECTION_RULES: Record<string, string[]> = {
    // Start events can connect to tasks and gateways
    'startEvent': ['userTask', 'serviceTask', 'scriptTask', 'exclusiveGateway', 'parallelGateway'],
    
    // Tasks can connect to other tasks, gateways, and end events
    'userTask': ['userTask', 'serviceTask', 'scriptTask', 'exclusiveGateway', 'parallelGateway', 'endEvent'],
    'serviceTask': ['userTask', 'serviceTask', 'scriptTask', 'exclusiveGateway', 'parallelGateway', 'endEvent'],
    'scriptTask': ['userTask', 'serviceTask', 'scriptTask', 'exclusiveGateway', 'parallelGateway', 'endEvent'],
    
    // Gateways can connect to tasks, other gateways, and end events
    'exclusiveGateway': ['userTask', 'serviceTask', 'scriptTask', 'exclusiveGateway', 'parallelGateway', 'endEvent'],
    'parallelGateway': ['userTask', 'serviceTask', 'scriptTask', 'exclusiveGateway', 'parallelGateway', 'endEvent'],
    
    // End events cannot connect to anything
    'endEvent': []
  };

  /**
   * Check if a connection between two elements is valid according to BPMN rules
   */
  static canConnect(source: BPMNElement, target: BPMNElement): boolean {
    // Cannot connect element to itself
    if (source.id === target.id) {
      return false;
    }

    // Check if source type can connect to target type
    const allowedTargets = this.CONNECTION_RULES[source.type];
    if (!allowedTargets) {
      return false;
    }

    return allowedTargets.includes(target.type);
  }

  /**
   * Get a message explaining why connection is not allowed
   */
  static getConnectionError(source: BPMNElement, target: BPMNElement): string {
    if (source.id === target.id) {
      return 'Cannot connect element to itself';
    }

    if (source.type === 'endEvent') {
      return 'End events cannot have outgoing connections';
    }

    if (target.type === 'startEvent') {
      return 'Start events cannot have incoming connections';
    }

    const allowedTargets = this.CONNECTION_RULES[source.type];
    if (!allowedTargets || !allowedTargets.includes(target.type)) {
      return `${this.getElementTypeLabel(source.type)} cannot connect to ${this.getElementTypeLabel(target.type)}`;
    }

    return '';
  }

  /**
   * Check if an element can have outgoing connections
   */
  static canHaveOutgoingConnections(element: BPMNElement): boolean {
    return element.type !== 'endEvent';
  }

  /**
   * Check if an element can have incoming connections
   */
  static canHaveIncomingConnections(element: BPMNElement): boolean {
    return element.type !== 'startEvent';
  }

  /**
   * Get human-readable label for element type
   */
  private static getElementTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'startEvent': 'Start Event',
      'endEvent': 'End Event',
      'userTask': 'User Task',
      'serviceTask': 'Service Task',
      'scriptTask': 'Script Task',
      'exclusiveGateway': 'Exclusive Gateway',
      'parallelGateway': 'Parallel Gateway'
    };
    return labels[type] || type;
  }

  /**
   * Check if connection would create a cycle (optional, for DAG validation)
   */
  static wouldCreateCycle(
    sourceId: string,
    targetId: string,
    existingConnections: Array<{ source: string; target: string }>
  ): boolean {
    // Build adjacency list
    const graph = new Map<string, Set<string>>();
    existingConnections.forEach(conn => {
      if (!graph.has(conn.source)) {
        graph.set(conn.source, new Set());
      }
      graph.get(conn.source)!.add(conn.target);
    });

    // Add the proposed connection
    if (!graph.has(sourceId)) {
      graph.set(sourceId, new Set());
    }
    graph.get(sourceId)!.add(targetId);

    // DFS to detect cycle
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    // Check from all unvisited nodes
    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (hasCycle(node)) {
          return true;
        }
      }
    }

    return false;
  }
}
