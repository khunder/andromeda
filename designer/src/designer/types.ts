export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface BPMNElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  properties?: Record<string, any>;
  bpmnType?: string; // BPMN 2.0 type mapping
}

export interface Connection {
  id: string;
  source: string;
  target: string;
  waypoints: Point[];
  type?: string;
  label?: string;
}

export interface DragState {
  isDragging: boolean;
  element: BPMNElement | null;
  offset: Point;
  originalPosition: Point | null;
  shadowGroup: SVGGElement | null;
  shadowConnections: SVGPathElement[];
}

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ElementType = 
  | 'startEvent' 
  | 'endEvent' 
  | 'userTask' 
  | 'serviceTask' 
  | 'scriptTask'
  | 'exclusiveGateway' 
  | 'parallelGateway';
