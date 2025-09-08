// BPMN XML Exporter using bpmn-moddle

import BpmnModdle from 'bpmn-moddle';
import { BPMNElement, Connection } from '../types';

export class BPMNExporter {
  private moddle: any;

  constructor() {
    this.moddle = new BpmnModdle();
  }

  /**
   * Export elements and connections to BPMN 2.0 XML
   */
  async exportToXML(elements: BPMNElement[], connections: Connection[]): Promise<string> {
    try {
      // Create root definitions
      const definitions = this.moddle.create('bpmn:Definitions', {
        id: 'Definitions_' + this.generateId(),
        targetNamespace: 'http://bpmn.io/schema/bpmn',
        'xmlns:bpmn': 'http://www.omg.org/spec/BPMN/20100524/MODEL',
        'xmlns:bpmndi': 'http://www.omg.org/spec/BPMN/20100524/DI',
        'xmlns:dc': 'http://www.omg.org/spec/DD/20100524/DC',
        'xmlns:di': 'http://www.omg.org/spec/DD/20100524/DI'
      });

      // Create process
      const process = this.moddle.create('bpmn:Process', {
        id: 'Process_' + this.generateId(),
        isExecutable: true
      });

      // Create BPMN elements
      const flowElements = [];
      const elementMap = new Map<string, any>();

      for (const element of elements) {
        const bpmnElement = this.createBPMNElement(element);
        if (bpmnElement) {
          flowElements.push(bpmnElement);
          elementMap.set(element.id, bpmnElement);
        }
      }

      // Create sequence flows
      for (const connection of connections) {
        const sequenceFlow = this.createSequenceFlow(connection, elementMap);
        if (sequenceFlow) {
          flowElements.push(sequenceFlow);
        }
      }

      process.flowElements = flowElements;
      definitions.rootElements = [process];

      // Create diagram
      const diagram = this.createDiagram(process.id, elements, connections);
      definitions.diagrams = [diagram];

      // Serialize to XML
      const { xml } = await this.moddle.toXML(definitions, { format: true });
      return xml;
    } catch (error) {
      console.error('Error exporting to BPMN XML:', error);
      throw error;
    }
  }

  /**
   * Create BPMN element from generic element
   */
  private createBPMNElement(element: BPMNElement): any {
    const elementId = element.id;
    const elementName = element.label || element.type;

    // Map element types to BPMN types
    const typeMapping: Record<string, string> = {
      'startEvent': 'bpmn:StartEvent',
      'endEvent': 'bpmn:EndEvent',
      'task': 'bpmn:Task',
      'userTask': 'bpmn:UserTask',
      'serviceTask': 'bpmn:ServiceTask',
      'scriptTask': 'bpmn:ScriptTask',
      'businessRuleTask': 'bpmn:BusinessRuleTask',
      'sendTask': 'bpmn:SendTask',
      'receiveTask': 'bpmn:ReceiveTask',
      'manualTask': 'bpmn:ManualTask',
      'exclusiveGateway': 'bpmn:ExclusiveGateway',
      'parallelGateway': 'bpmn:ParallelGateway',
      'inclusiveGateway': 'bpmn:InclusiveGateway',
      'eventBasedGateway': 'bpmn:EventBasedGateway',
      'complexGateway': 'bpmn:ComplexGateway',
      'subProcess': 'bpmn:SubProcess',
      'callActivity': 'bpmn:CallActivity',
      'dataObject': 'bpmn:DataObjectReference',
      'dataStore': 'bpmn:DataStoreReference',
      'messageFlow': 'bpmn:MessageFlow',
      'association': 'bpmn:Association',
      'textAnnotation': 'bpmn:TextAnnotation'
    };

    const bpmnType = typeMapping[element.type] || 'bpmn:Task';
    
    const bpmnElement = this.moddle.create(bpmnType, {
      id: elementId,
      name: elementName
    });

    // Add specific properties based on type
    if (element.type === 'scriptTask' && element.properties) {
      bpmnElement.scriptFormat = element.properties.scriptLanguage || 'javascript';
      bpmnElement.script = element.properties.script || '';
      if (element.properties.resultVariable) {
        bpmnElement.resultVariable = element.properties.resultVariable;
      }
      if (element.properties.async) {
        bpmnElement.async = element.properties.async;
      }
    }

    // Add custom properties as extension elements
    if (element.properties && Object.keys(element.properties).length > 0) {
      const extensionElements = this.moddle.create('bpmn:ExtensionElements');
      const properties = this.moddle.create('bpmn:Properties');
      
      for (const [key, value] of Object.entries(element.properties)) {
        if (key !== 'script' && key !== 'scriptLanguage' && key !== 'resultVariable' && key !== 'async') {
          const property = this.moddle.create('bpmn:Property', {
            name: key,
            value: String(value)
          });
          if (!properties.values) properties.values = [];
          properties.values.push(property);
        }
      }
      
      if (properties.values && properties.values.length > 0) {
        extensionElements.values = [properties];
        bpmnElement.extensionElements = extensionElements;
      }
    }

    return bpmnElement;
  }

  /**
   * Create sequence flow from connection
   */
  private createSequenceFlow(connection: Connection, elementMap: Map<string, any>): any {
    const sourceElement = elementMap.get(connection.source);
    const targetElement = elementMap.get(connection.target);

    if (!sourceElement || !targetElement) {
      console.warn(`Cannot create sequence flow: source or target not found for connection ${connection.id}`);
      return null;
    }

    const sequenceFlow = this.moddle.create('bpmn:SequenceFlow', {
      id: connection.id,
      sourceRef: sourceElement,
      targetRef: targetElement
    });

    // Update source and target element references
    if (!sourceElement.outgoing) sourceElement.outgoing = [];
    sourceElement.outgoing.push(sequenceFlow);

    if (!targetElement.incoming) targetElement.incoming = [];
    targetElement.incoming.push(sequenceFlow);

    return sequenceFlow;
  }

  /**
   * Create BPMNDI diagram
   */
  private createDiagram(processId: string, elements: BPMNElement[], connections: Connection[]): any {
    const plane = this.moddle.create('bpmndi:BPMNPlane', {
      id: 'BPMNPlane_' + this.generateId(),
      bpmnElement: { id: processId }
    });

    const planeElements = [];

    // Create shapes for elements
    for (const element of elements) {
      const shape = this.moddle.create('bpmndi:BPMNShape', {
        id: element.id + '_di',
        bpmnElement: { id: element.id }
      });

      const bounds = this.moddle.create('dc:Bounds', {
        x: element.bounds.x,
        y: element.bounds.y,
        width: element.bounds.width,
        height: element.bounds.height
      });

      shape.bounds = bounds;
      planeElements.push(shape);
    }

    // Create edges for connections
    for (const connection of connections) {
      const edge = this.moddle.create('bpmndi:BPMNEdge', {
        id: connection.id + '_di',
        bpmnElement: { id: connection.id }
      });

      const waypoints = [];
      for (const point of connection.waypoints) {
        waypoints.push(this.moddle.create('dc:Point', {
          x: point.x,
          y: point.y
        }));
      }

      edge.waypoint = waypoints;
      planeElements.push(edge);
    }

    plane.planeElement = planeElements;

    const diagram = this.moddle.create('bpmndi:BPMNDiagram', {
      id: 'BPMNDiagram_' + this.generateId()
    });
    diagram.plane = plane;

    return diagram;
  }

  /**
   * Import BPMN XML to elements and connections
   */
  async importFromXML(xml: string): Promise<{ elements: BPMNElement[], connections: Connection[] }> {
    try {
      const { rootElement } = await this.moddle.fromXML(xml);
      
      const elements: BPMNElement[] = [];
      const connections: Connection[] = [];

      // Find the process
      const process = rootElement.rootElements?.find((e: any) => e.$type === 'bpmn:Process');
      if (!process) {
        throw new Error('No process found in BPMN XML');
      }

      // Find the diagram
      const diagram = rootElement.diagrams?.[0];
      const plane = diagram?.plane;
      const shapes = new Map<string, any>();
      const edges = new Map<string, any>();

      if (plane) {
        for (const element of plane.planeElement || []) {
          if (element.$type === 'bpmndi:BPMNShape') {
            shapes.set(element.bpmnElement.id, element);
          } else if (element.$type === 'bpmndi:BPMNEdge') {
            edges.set(element.bpmnElement.id, element);
          }
        }
      }

      // Process flow elements
      for (const flowElement of process.flowElements || []) {
        if (flowElement.$type === 'bpmn:SequenceFlow') {
          // Handle connections
          const edge = edges.get(flowElement.id);
          const waypoints = edge?.waypoint?.map((wp: any) => ({ x: wp.x, y: wp.y })) || [];
          
          connections.push({
            id: flowElement.id,
            source: flowElement.sourceRef.id,
            target: flowElement.targetRef.id,
            type: 'sequenceFlow',
            waypoints
          });
        } else {
          // Handle elements
          const shape = shapes.get(flowElement.id);
          const bounds = shape?.bounds || { x: 0, y: 0, width: 100, height: 80 };
          
          const element: BPMNElement = {
            id: flowElement.id,
            type: this.mapBPMNTypeToSimpleType(flowElement.$type),
            bounds: {
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height
            },
            label: flowElement.name,
            properties: {}
          };

          // Extract properties
          if (flowElement.$type === 'bpmn:ScriptTask') {
            element.properties!.scriptLanguage = flowElement.scriptFormat || 'javascript';
            element.properties!.script = flowElement.script || '';
            element.properties!.resultVariable = flowElement.resultVariable;
            element.properties!.async = flowElement.async;
          }

          // Extract custom properties from extension elements
          if (flowElement.extensionElements?.values) {
            for (const extension of flowElement.extensionElements.values) {
              if (extension.$type === 'bpmn:Properties' && extension.values) {
                for (const property of extension.values) {
                  element.properties![property.name] = property.value;
                }
              }
            }
          }

          elements.push(element);
        }
      }

      return { elements, connections };
    } catch (error) {
      console.error('Error importing BPMN XML:', error);
      throw error;
    }
  }

  /**
   * Map BPMN type to simple type
   */
  private mapBPMNTypeToSimpleType(bpmnType: string): string {
    const mapping: Record<string, string> = {
      'bpmn:StartEvent': 'startEvent',
      'bpmn:EndEvent': 'endEvent',
      'bpmn:Task': 'task',
      'bpmn:UserTask': 'userTask',
      'bpmn:ServiceTask': 'serviceTask',
      'bpmn:ScriptTask': 'scriptTask',
      'bpmn:BusinessRuleTask': 'businessRuleTask',
      'bpmn:SendTask': 'sendTask',
      'bpmn:ReceiveTask': 'receiveTask',
      'bpmn:ManualTask': 'manualTask',
      'bpmn:ExclusiveGateway': 'exclusiveGateway',
      'bpmn:ParallelGateway': 'parallelGateway',
      'bpmn:InclusiveGateway': 'inclusiveGateway',
      'bpmn:EventBasedGateway': 'eventBasedGateway',
      'bpmn:ComplexGateway': 'complexGateway',
      'bpmn:SubProcess': 'subProcess',
      'bpmn:CallActivity': 'callActivity',
      'bpmn:DataObjectReference': 'dataObject',
      'bpmn:DataStoreReference': 'dataStore',
      'bpmn:MessageFlow': 'messageFlow',
      'bpmn:Association': 'association',
      'bpmn:TextAnnotation': 'textAnnotation'
    };

    return mapping[bpmnType] || 'task';
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
