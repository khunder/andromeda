import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionManager } from './ConnectionManager';
import { BPMNElement } from './types';

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  
  // Mock elements for testing
  const sourceElement: BPMNElement = {
    id: 'source1',
    type: 'userTask',
    x: 100,
    y: 100,
    width: 100,
    height: 80,
    label: 'Source Task'
  };
  
  const targetElement: BPMNElement = {
    id: 'target1',
    type: 'userTask',
    x: 300,
    y: 100,
    width: 100,
    height: 80,
    label: 'Target Task'
  };

  beforeEach(() => {
    connectionManager = new ConnectionManager();
  });

  describe('addConnection', () => {
    it('should create a new connection between elements', () => {
      const connectionId = connectionManager.addConnection('source1', 'target1');
      const connection = connectionManager.getConnection(connectionId);

      expect(connection).toBeDefined();
      expect(connection?.source).toBe('source1');
      expect(connection?.target).toBe('target1');
      expect(connection?.waypoints).toEqual([]);
    });

    it('should generate unique IDs for connections', () => {
      const id1 = connectionManager.addConnection('source1', 'target1');
      const id2 = connectionManager.addConnection('source2', 'target2');

      expect(id1).not.toBe(id2);
      expect(connectionManager.getConnection(id1)).toBeDefined();
      expect(connectionManager.getConnection(id2)).toBeDefined();
    });
  });

  describe('updateConnectionWaypoints', () => {
    it('should update waypoints for aligned elements', () => {
      const connectionId = connectionManager.addConnection('source1', 'target1');
      const connection = connectionManager.getConnection(connectionId)!;

      connectionManager.updateConnectionWaypoints(connection, sourceElement, targetElement);

      expect(connection.waypoints).toHaveLength(2);
      expect(connection.waypoints[0]).toHaveProperty('x');
      expect(connection.waypoints[0]).toHaveProperty('y');
    });

    it('should create L-shaped connection for diagonal elements', () => {
      const diagonalTarget: BPMNElement = {
        ...targetElement,
        y: 250 // Positioned diagonally
      };

      const connectionId = connectionManager.addConnection('source1', 'target1');
      const connection = connectionManager.getConnection(connectionId)!;

      connectionManager.updateConnectionWaypoints(connection, sourceElement, diagonalTarget);

      // Should have waypoints for L-shaped path
      expect(connection.waypoints.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getConnectionPoint', () => {
    it('should calculate connection point for rectangular elements', () => {
      const point = connectionManager.getConnectionPoint(sourceElement, targetElement);

      expect(point).toHaveProperty('x');
      expect(point).toHaveProperty('y');
      // Connection point should be on the edge of the source element
      expect(point.x).toBeGreaterThanOrEqual(sourceElement.x);
      expect(point.x).toBeLessThanOrEqual(sourceElement.x + sourceElement.width);
    });

    it('should calculate connection point for events', () => {
      const eventElement: BPMNElement = {
        id: 'event1',
        type: 'startEvent',
        x: 50,
        y: 50,
        width: 36,
        height: 36,
        label: 'Start'
      };

      const point = connectionManager.getConnectionPoint(eventElement, targetElement);

      expect(point).toHaveProperty('x');
      expect(point).toHaveProperty('y');
    });

    it('should calculate connection point for gateways', () => {
      const gatewayElement: BPMNElement = {
        id: 'gateway1',
        type: 'exclusiveGateway',
        x: 50,
        y: 50,
        width: 50,
        height: 50,
        label: 'Gateway'
      };

      const point = connectionManager.getConnectionPoint(gatewayElement, targetElement);

      expect(point).toHaveProperty('x');
      expect(point).toHaveProperty('y');
    });
  });

  describe('getConnectionsForElement', () => {
    it('should return all connections for an element', () => {
      connectionManager.addConnection('source1', 'element1');
      connectionManager.addConnection('element1', 'target1');
      connectionManager.addConnection('source2', 'target2');

      const connections = connectionManager.getConnectionsForElement('element1');

      expect(connections).toHaveLength(2);
      expect(connections.some(c => c.source === 'source1')).toBe(true);
      expect(connections.some(c => c.target === 'target1')).toBe(true);
    });

    it('should return empty array for element with no connections', () => {
      const connections = connectionManager.getConnectionsForElement('lonely-element');
      expect(connections).toEqual([]);
    });
  });

  describe('deleteConnection', () => {
    it('should remove a connection', () => {
      const connectionId = connectionManager.addConnection('source1', 'target1');
      expect(connectionManager.getConnection(connectionId)).toBeDefined();

      connectionManager.deleteConnection(connectionId);
      expect(connectionManager.getConnection(connectionId)).toBeUndefined();
    });
  });

  describe('deleteConnectionsForElement', () => {
    it('should remove all connections for an element', () => {
      const id1 = connectionManager.addConnection('source1', 'element1');
      const id2 = connectionManager.addConnection('element1', 'target1');
      const id3 = connectionManager.addConnection('source2', 'target2');

      connectionManager.deleteConnectionsForElement('element1');

      expect(connectionManager.getConnection(id1)).toBeUndefined();
      expect(connectionManager.getConnection(id2)).toBeUndefined();
      expect(connectionManager.getConnection(id3)).toBeDefined(); // Should still exist
    });
  });

  describe('clear', () => {
    it('should remove all connections', () => {
      connectionManager.addConnection('source1', 'target1');
      connectionManager.addConnection('source2', 'target2');
      expect(connectionManager.getAllConnections()).toHaveLength(2);

      connectionManager.clear();
      expect(connectionManager.getAllConnections()).toHaveLength(0);
    });
  });
});
