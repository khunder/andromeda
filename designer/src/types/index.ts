// Core types for the BPMN Designer library

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Connection {
  id: string;
  source: string;
  target: string;
  waypoints: Point[];
  type: ConnectionType;
}

export enum ConnectionType {
  SEQUENCE_FLOW = 'sequenceFlow',
  MESSAGE_FLOW = 'messageFlow',
  ASSOCIATION = 'association',
  DATA_ASSOCIATION = 'dataAssociation'
}

export interface BPMNElement {
  id: string;
  type: BPMNElementType;
  bounds: Bounds;
  businessObject?: any;
  label?: string;
  parent?: string;
  incoming?: string[];
  outgoing?: string[];
}

export enum BPMNElementType {
  // Events
  START_EVENT = 'startEvent',
  END_EVENT = 'endEvent',
  INTERMEDIATE_CATCH_EVENT = 'intermediateCatchEvent',
  INTERMEDIATE_THROW_EVENT = 'intermediateThrowEvent',
  BOUNDARY_EVENT = 'boundaryEvent',
  
  // Tasks
  TASK = 'task',
  USER_TASK = 'userTask',
  SERVICE_TASK = 'serviceTask',
  SCRIPT_TASK = 'scriptTask',
  BUSINESS_RULE_TASK = 'businessRuleTask',
  SEND_TASK = 'sendTask',
  RECEIVE_TASK = 'receiveTask',
  MANUAL_TASK = 'manualTask',
  
  // Gateways
  EXCLUSIVE_GATEWAY = 'exclusiveGateway',
  PARALLEL_GATEWAY = 'parallelGateway',
  INCLUSIVE_GATEWAY = 'inclusiveGateway',
  EVENT_BASED_GATEWAY = 'eventBasedGateway',
  COMPLEX_GATEWAY = 'complexGateway',
  
  // Subprocess
  SUB_PROCESS = 'subProcess',
  TRANSACTION = 'transaction',
  AD_HOC_SUB_PROCESS = 'adHocSubProcess',
  
  // Pools and Lanes
  POOL = 'pool',
  LANE = 'lane',
  
  // Data
  DATA_OBJECT = 'dataObject',
  DATA_INPUT = 'dataInput',
  DATA_OUTPUT = 'dataOutput',
  DATA_STORE = 'dataStore',
  
  // Other
  TEXT_ANNOTATION = 'textAnnotation',
  GROUP = 'group'
}

export interface ViewerOptions {
  container: HTMLElement | string;
  width?: number | string;
  height?: number | string;
  xml?: string;
}

export interface ModelerOptions extends ViewerOptions {
  keyboard?: {
    bindTo?: HTMLElement;
  };
  propertiesPanel?: {
    parent: HTMLElement | string;
  };
}

export interface Command {
  id: string;
  execute(): void;
  undo(): void;
  redo(): void;
}
