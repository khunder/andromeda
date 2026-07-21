export interface IconDefinition {
  type: 'path' | 'text' | 'image' | 'svg';
  content: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface LabelPosition {
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  offset: { x: number; y: number };
}

export interface ElementStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  opacity?: number;
  borderRadius?: number;
}

export interface ElementDefinition {
  type: string;
  category: 'event' | 'task' | 'gateway' | 'custom';
  label: string;
  shape: 'circle' | 'rectangle' | 'diamond' | 'hexagon' | 'custom';
  defaultSize: { width: number; height: number };
  style: ElementStyle;
  icon?: IconDefinition;
  labelPosition?: LabelPosition;
  connectionPoints?: Array<{ position: string; x: number; y: number }>;
  customRenderer?: (element: any, container: SVGElement) => void;
  allowIncoming?: boolean;
  allowOutgoing?: boolean;
  connectableTypes?: string[];
}

export class ElementRegistry {
  private definitions: Map<string, ElementDefinition> = new Map();
  
  constructor() {
    this.registerDefaultElements();
  }
  
  private registerDefaultElements(): void {
    // Start Event
    this.register({
      type: 'startEvent',
      category: 'event',
      label: 'Start Event',
      shape: 'circle',
      defaultSize: { width: 36, height: 36 },
      style: {
        fill: '#ffffff',
        stroke: '#4caf50',
        strokeWidth: 2
      },
      labelPosition: {
        position: 'bottom',
        offset: { x: 0, y: 5 }
      },
      allowIncoming: false,
      allowOutgoing: true
    });
    
    // End Event
    this.register({
      type: 'endEvent',
      category: 'event',
      label: 'End Event',
      shape: 'circle',
      defaultSize: { width: 36, height: 36 },
      style: {
        fill: '#ffffff',
        stroke: '#f44336',
        strokeWidth: 4
      },
      labelPosition: {
        position: 'bottom',
        offset: { x: 0, y: 0 }
      },
      allowIncoming: true,
      allowOutgoing: false
    });
    
    // User Task
    this.register({
      type: 'userTask',
      category: 'task',
      label: 'User Task',
      shape: 'rectangle',
      defaultSize: { width: 100, height: 80 },
      style: {
        fill: '#e3f2fd',
        stroke: '#1976d2',
        strokeWidth: 2,
        borderRadius: 5
      },
      icon: {
        type: 'svg',
        content: `<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>`,
        position: { x: 5, y: 5 },
        size: { width: 20, height: 20 }
      },
      labelPosition: {
        position: 'center',
        offset: { x: 0, y: 0 }
      },
      allowIncoming: true,
      allowOutgoing: true
    });
    
    // Service Task
    this.register({
      type: 'serviceTask',
      category: 'task',
      label: 'Service Task',
      shape: 'rectangle',
      defaultSize: { width: 100, height: 80 },
      style: {
        fill: '#fff3e0',
        stroke: '#f57c00',
        strokeWidth: 2,
        borderRadius: 5
      },
      icon: {
        type: 'svg',
        content: `<path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.13-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>`,
        position: { x: 5, y: 5 },
        size: { width: 20, height: 20 }
      },
      labelPosition: {
        position: 'center',
        offset: { x: 0, y: 0 }
      },
      allowIncoming: true,
      allowOutgoing: true
    });
    
    // Script Task
    this.register({
      type: 'scriptTask',
      category: 'task',
      label: 'Script Task',
      shape: 'rectangle',
      defaultSize: { width: 100, height: 80 },
      style: {
        fill: '#f3e5f5',
        stroke: '#7b1fa2',
        strokeWidth: 2,
        borderRadius: 5
      },
      icon: {
        type: 'text',
        content: '</>',
        position: { x: 5, y: 5 },
        size: { width: 20, height: 20 }
      },
      labelPosition: {
        position: 'center',
        offset: { x: 0, y: 0 }
      },
      allowIncoming: true,
      allowOutgoing: true
    });
    
    // Exclusive Gateway
    this.register({
      type: 'exclusiveGateway',
      category: 'gateway',
      label: 'Exclusive Gateway',
      shape: 'diamond',
      defaultSize: { width: 50, height: 50 },
      style: {
        fill: '#fff8e1',
        stroke: '#ffa000',
        strokeWidth: 2
      },
      icon: {
        type: 'text',
        content: 'X',
        position: { x: 0, y: 0 },
        size: { width: 50, height: 50 }
      },
      labelPosition: {
        position: 'bottom',
        offset: { x: 0, y: 10 }
      },
      allowIncoming: true,
      allowOutgoing: true
    });
    
    // Parallel Gateway
    this.register({
      type: 'parallelGateway',
      category: 'gateway',
      label: 'Parallel Gateway',
      shape: 'diamond',
      defaultSize: { width: 50, height: 50 },
      style: {
        fill: '#e8f5e9',
        stroke: '#4caf50',
        strokeWidth: 2
      },
      icon: {
        type: 'text',
        content: '+',
        position: { x: 0, y: 0 },
        size: { width: 50, height: 50 }
      },
      labelPosition: {
        position: 'bottom',
        offset: { x: 0, y: 10 }
      },
      allowIncoming: true,
      allowOutgoing: true
    });
  }
  
  register(definition: ElementDefinition): void {
    this.definitions.set(definition.type, definition);
  }
  
  get(type: string): ElementDefinition | undefined {
    return this.definitions.get(type);
  }
  
  getAll(): ElementDefinition[] {
    return Array.from(this.definitions.values());
  }
  
  getByCategory(category: string): ElementDefinition[] {
    return this.getAll().filter(def => def.category === category);
  }
  
  unregister(type: string): void {
    this.definitions.delete(type);
  }
  
  update(type: string, updates: Partial<ElementDefinition>): void {
    const existing = this.definitions.get(type);
    if (existing) {
      this.definitions.set(type, { ...existing, ...updates });
    }
  }
}
