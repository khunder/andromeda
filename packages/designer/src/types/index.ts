// Core types for extensible BPMN Designer

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
  type: string;
  data?: any;
}

export interface BPMNElement {
  id: string;
  type: string;
  bounds: Bounds;
  data?: any;
  label?: string;
  parent?: string;
  incoming?: string[];
  outgoing?: string[];
  properties?: Record<string, any>;
}

// Component Registration Types
export interface ComponentDefinition {
  type: string;
  category: 'event' | 'task' | 'gateway' | 'flow' | 'data' | 'custom';
  label: string;
  icon?: string;
  defaultSize: { width: number; height: number };
  resizable?: boolean;
  rotatable?: boolean;
  connectionRules?: ConnectionRules;
  properties?: PropertyDefinition[];
  renderer: ComponentRenderer;
  behavior?: ComponentBehavior;
}

export interface ConnectionRules {
  canConnect?: (source: BPMNElement, target: BPMNElement) => boolean;
  maxIncoming?: number;
  maxOutgoing?: number;
  allowedSources?: string[];
  allowedTargets?: string[];
}

export interface PropertyDefinition {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'code' | 'json';
  default?: any;
  options?: Array<{ value: any; label: string }>;
  validation?: (value: any) => boolean | string;
  visible?: (element: BPMNElement) => boolean;
}

export interface ComponentRenderer {
  render(element: BPMNElement, container: SVGGElement): SVGElement;
  update?(element: BPMNElement, svgElement: SVGElement): void;
  getConnectionPoint?(element: BPMNElement, reference: Point, type: 'source' | 'target'): Point;
  getHandles?(element: BPMNElement): Handle[];
}

export interface ComponentBehavior {
  onCreate?(element: BPMNElement): void;
  onUpdate?(element: BPMNElement, changes: Partial<BPMNElement>): void;
  onDelete?(element: BPMNElement): void;
  onConnect?(element: BPMNElement, connection: Connection, type: 'source' | 'target'): void;
  onDisconnect?(element: BPMNElement, connection: Connection, type: 'source' | 'target'): void;
  onExecute?(element: BPMNElement, context: ExecutionContext): Promise<any>;
}

export interface Handle {
  id: string;
  type: 'resize' | 'rotate' | 'connection' | 'custom';
  position: Point;
  cursor?: string;
  visible?: boolean;
}

export interface ExecutionContext {
  variables: Map<string, any>;
  services: Map<string, any>;
  logger: Logger;
  signal: (event: string, data?: any) => void;
}

export interface Logger {
  log(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
}

// Plugin System
export interface Plugin {
  name: string;
  version: string;
  components?: ComponentDefinition[];
  services?: ServiceDefinition[];
  initialize?(designer: any): void;
  destroy?(): void;
}

export interface ServiceDefinition {
  name: string;
  factory: () => any;
}

// Events
export interface DesignerEvent {
  type: string;
  data?: any;
  timestamp: number;
  source?: string;
  cancelable?: boolean;
}

// Export/Import
export interface BPMNExport {
  elements: BPMNElement[];
  connections: Connection[];
  metadata?: {
    version: string;
    created: string;
    modified: string;
    plugins?: string[];
  };
}
