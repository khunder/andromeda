import { BPMNElement, Connection } from './types';

export class BPMNExporter {
  private static readonly BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
  private static readonly BPMNDI_NS = 'http://www.omg.org/spec/BPMN/20100524/DI';
  private static readonly DC_NS = 'http://www.omg.org/spec/DD/20100524/DC';
  private static readonly DI_NS = 'http://www.omg.org/spec/DD/20100524/DI';

  // BPMN type mappings
  private static readonly TYPE_MAPPINGS: Record<string, string> = {
    'startEvent': 'startEvent',
    'endEvent': 'endEvent',
    'userTask': 'userTask',
    'serviceTask': 'serviceTask',
    'scriptTask': 'scriptTask',
    'exclusiveGateway': 'exclusiveGateway',
    'parallelGateway': 'parallelGateway'
  };

  static exportToXML(elements: BPMNElement[], connections: Connection[]): string {
    const doc = document.implementation.createDocument(this.BPMN_NS, 'definitions', null);
    const definitions = doc.documentElement;
    
    // Set namespaces
    definitions.setAttribute('xmlns:bpmndi', this.BPMNDI_NS);
    definitions.setAttribute('xmlns:dc', this.DC_NS);
    definitions.setAttribute('xmlns:di', this.DI_NS);
    definitions.setAttribute('targetNamespace', 'http://bpmn.io/schema/bpmn');
    definitions.setAttribute('id', `Definitions_${this.generateId()}`);
    
    // Create process
    const process = doc.createElementNS(this.BPMN_NS, 'process');
    process.setAttribute('id', `Process_${this.generateId()}`);
    process.setAttribute('isExecutable', 'true');
    
    // Add elements
    elements.forEach(element => {
      const bpmnElement = this.createBPMNElement(doc, element);
      if (bpmnElement) {
        process.appendChild(bpmnElement);
      }
    });
    
    // Add connections (sequence flows)
    connections.forEach(connection => {
      const sequenceFlow = doc.createElementNS(this.BPMN_NS, 'sequenceFlow');
      sequenceFlow.setAttribute('id', connection.id);
      sequenceFlow.setAttribute('sourceRef', connection.source);
      sequenceFlow.setAttribute('targetRef', connection.target);
      if (connection.label) {
        sequenceFlow.setAttribute('name', connection.label);
      }
      process.appendChild(sequenceFlow);
    });
    
    definitions.appendChild(process);
    
    // Create diagram
    const diagram = this.createDiagram(doc, process.getAttribute('id')!, elements, connections);
    definitions.appendChild(diagram);
    
    // Serialize to string
    const serializer = new XMLSerializer();
    let xmlString = serializer.serializeToString(doc);
    
    // Format XML
    xmlString = this.formatXML(xmlString);
    
    // Add XML declaration
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlString;
  }

  private static createBPMNElement(doc: Document, element: BPMNElement): Element | null {
    const bpmnType = this.TYPE_MAPPINGS[element.type];
    if (!bpmnType) return null;
    
    const bpmnElement = doc.createElementNS(this.BPMN_NS, bpmnType);
    bpmnElement.setAttribute('id', element.id);
    bpmnElement.setAttribute('name', element.label);
    
    // Add specific attributes based on type
    if (element.type === 'scriptTask' && element.properties) {
      if (element.properties.scriptLanguage) {
        bpmnElement.setAttribute('scriptFormat', element.properties.scriptLanguage);
      }
      if (element.properties.script) {
        const script = doc.createElementNS(this.BPMN_NS, 'script');
        script.textContent = element.properties.script;
        bpmnElement.appendChild(script);
      }
    }
    
    if (element.type === 'serviceTask' && element.properties) {
      if (element.properties.implementation) {
        bpmnElement.setAttribute('implementation', element.properties.implementation);
      }
    }
    
    return bpmnElement;
  }

  private static createDiagram(
    doc: Document,
    processId: string,
    elements: BPMNElement[],
    connections: Connection[]
  ): Element {
    const diagram = doc.createElementNS(this.BPMNDI_NS, 'BPMNDiagram');
    diagram.setAttribute('id', `BPMNDiagram_${this.generateId()}`);
    
    const plane = doc.createElementNS(this.BPMNDI_NS, 'BPMNPlane');
    plane.setAttribute('id', `BPMNPlane_${this.generateId()}`);
    plane.setAttribute('bpmnElement', processId);
    
    // Add shapes for elements
    elements.forEach(element => {
      const shape = doc.createElementNS(this.BPMNDI_NS, 'BPMNShape');
      shape.setAttribute('id', `${element.id}_di`);
      shape.setAttribute('bpmnElement', element.id);
      
      const bounds = doc.createElementNS(this.DC_NS, 'Bounds');
      bounds.setAttribute('x', String(element.x));
      bounds.setAttribute('y', String(element.y));
      bounds.setAttribute('width', String(element.width));
      bounds.setAttribute('height', String(element.height));
      
      shape.appendChild(bounds);
      plane.appendChild(shape);
    });
    
    // Add edges for connections
    connections.forEach(connection => {
      const edge = doc.createElementNS(this.BPMNDI_NS, 'BPMNEdge');
      edge.setAttribute('id', `${connection.id}_di`);
      edge.setAttribute('bpmnElement', connection.id);
      
      connection.waypoints.forEach(waypoint => {
        const wp = doc.createElementNS(this.DI_NS, 'waypoint');
        wp.setAttribute('x', String(waypoint.x));
        wp.setAttribute('y', String(waypoint.y));
        edge.appendChild(wp);
      });
      
      plane.appendChild(edge);
    });
    
    diagram.appendChild(plane);
    return diagram;
  }

  private static generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private static formatXML(xml: string): string {
    const PADDING = '  ';
    const reg = /(>)(<)(\/*)/g;
    let pad = 0;
    
    xml = xml.replace(reg, '$1\n$2$3');
    
    return xml.split('\n').map(node => {
      let indent = 0;
      if (node.match(/.+<\/\w[^>]*>$/)) {
        indent = 0;
      } else if (node.match(/^<\/\w/) && pad > 0) {
        pad -= 1;
      } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
        indent = 1;
      } else {
        indent = 0;
      }
      
      const padding = PADDING.repeat(pad);
      pad += indent;
      
      return padding + node;
    }).join('\n');
  }

  static async importFromXML(xmlString: string): Promise<{ elements: BPMNElement[], connections: Connection[] }> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    
    const elements: BPMNElement[] = [];
    const connections: Connection[] = [];
    
    // Parse process elements
    const process = doc.getElementsByTagNameNS(this.BPMN_NS, 'process')[0];
    if (!process) {
      throw new Error('No process found in BPMN XML');
    }
    
    // Parse flow nodes (events, tasks, gateways)
    const flowNodes = process.querySelectorAll('startEvent, endEvent, userTask, serviceTask, scriptTask, exclusiveGateway, parallelGateway');
    
    flowNodes.forEach(node => {
      const id = node.getAttribute('id') || '';
      const name = node.getAttribute('name') || '';
      const type = node.localName;
      
      // Get bounds from diagram
      const shape = doc.querySelector(`BPMNShape[bpmnElement="${id}"]`);
      if (shape) {
        const bounds = shape.querySelector('Bounds');
        if (bounds) {
          const element: BPMNElement = {
            id,
            type,
            label: name,
            x: parseFloat(bounds.getAttribute('x') || '0'),
            y: parseFloat(bounds.getAttribute('y') || '0'),
            width: parseFloat(bounds.getAttribute('width') || '100'),
            height: parseFloat(bounds.getAttribute('height') || '80'),
            bpmnType: type
          };
          
          // Parse script task properties
          if (type === 'scriptTask') {
            const scriptElement = node.querySelector('script');
            if (scriptElement) {
              element.properties = {
                script: scriptElement.textContent,
                scriptLanguage: node.getAttribute('scriptFormat') || 'javascript'
              };
            }
          }
          
          elements.push(element);
        }
      }
    });
    
    // Parse sequence flows
    const sequenceFlows = process.getElementsByTagNameNS(this.BPMN_NS, 'sequenceFlow');
    
    Array.from(sequenceFlows).forEach(flow => {
      const id = flow.getAttribute('id') || '';
      const source = flow.getAttribute('sourceRef') || '';
      const target = flow.getAttribute('targetRef') || '';
      const label = flow.getAttribute('name') || '';
      
      // Get waypoints from diagram
      const edge = doc.querySelector(`BPMNEdge[bpmnElement="${id}"]`);
      const waypoints: Point[] = [];
      
      if (edge) {
        const wps = edge.querySelectorAll('waypoint');
        wps.forEach(wp => {
          waypoints.push({
            x: parseFloat(wp.getAttribute('x') || '0'),
            y: parseFloat(wp.getAttribute('y') || '0')
          });
        });
      }
      
      connections.push({
        id,
        source,
        target,
        waypoints,
        label
      });
    });
    
    return { elements, connections };
  }
}
