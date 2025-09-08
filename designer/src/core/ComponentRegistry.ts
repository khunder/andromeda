// Component Registry for dynamic component registration

import { ComponentDefinition, BPMNElement, Point } from '../types';

export class ComponentRegistry {
  private components: Map<string, ComponentDefinition> = new Map();
  private categories: Map<string, Set<string>> = new Map();

  constructor() {
    this.initializeCategories();
  }

  private initializeCategories(): void {
    const categories = ['event', 'task', 'gateway', 'flow', 'data', 'custom'];
    categories.forEach(cat => this.categories.set(cat, new Set()));
  }

  /**
   * Register a new component type
   */
  register(definition: ComponentDefinition): void {
    if (this.components.has(definition.type)) {
      console.warn(`Component type "${definition.type}" is already registered. Overwriting...`);
    }

    // Validate the definition
    this.validateDefinition(definition);

    // Register the component
    this.components.set(definition.type, definition);

    // Add to category
    const categorySet = this.categories.get(definition.category);
    if (categorySet) {
      categorySet.add(definition.type);
    }

    console.log(`Registered component: ${definition.type}`);
  }

  /**
   * Unregister a component type
   */
  unregister(type: string): boolean {
    const definition = this.components.get(type);
    if (!definition) return false;

    // Remove from category
    const categorySet = this.categories.get(definition.category);
    if (categorySet) {
      categorySet.delete(type);
    }

    // Remove component
    return this.components.delete(type);
  }

  /**
   * Get a component definition
   */
  get(type: string): ComponentDefinition | undefined {
    return this.components.get(type);
  }

  /**
   * Get all registered components
   */
  getAll(): ComponentDefinition[] {
    return Array.from(this.components.values());
  }

  /**
   * Get components by category
   */
  getByCategory(category: string): ComponentDefinition[] {
    const types = this.categories.get(category);
    if (!types) return [];

    return Array.from(types)
      .map(type => this.components.get(type))
      .filter(def => def !== undefined) as ComponentDefinition[];
  }

  /**
   * Check if a component type is registered
   */
  has(type: string): boolean {
    return this.components.has(type);
  }

  /**
   * Validate a component definition
   */
  private validateDefinition(definition: ComponentDefinition): void {
    if (!definition.type) {
      throw new Error('Component type is required');
    }
    if (!definition.category) {
      throw new Error('Component category is required');
    }
    if (!definition.label) {
      throw new Error('Component label is required');
    }
    if (!definition.defaultSize) {
      throw new Error('Component defaultSize is required');
    }
    if (!definition.renderer) {
      throw new Error('Component renderer is required');
    }
    if (!definition.renderer.render) {
      throw new Error('Component renderer must have a render method');
    }
  }

  /**
   * Create an element instance from a component type
   */
  createElement(type: string, bounds: { x: number; y: number }): BPMNElement | null {
    const definition = this.components.get(type);
    if (!definition) return null;

    const element: BPMNElement = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: definition.defaultSize.width,
        height: definition.defaultSize.height
      },
      label: definition.label,
      properties: {}
    };

    // Set default property values
    if (definition.properties) {
      definition.properties.forEach(prop => {
        if (prop.default !== undefined) {
          element.properties![prop.name] = prop.default;
        }
      });
    }

    // Call onCreate behavior if defined
    if (definition.behavior?.onCreate) {
      definition.behavior.onCreate(element);
    }

    return element;
  }

  /**
   * Render an element using its registered renderer
   */
  render(element: BPMNElement, container: SVGGElement): SVGElement | null {
    const definition = this.components.get(element.type);
    if (!definition) {
      console.error(`No renderer found for type: ${element.type}`);
      return null;
    }

    return definition.renderer.render(element, container);
  }

  /**
   * Get connection point for an element
   */
  getConnectionPoint(element: BPMNElement, reference: Point, type: 'source' | 'target'): Point {
    const definition = this.components.get(element.type);
    if (!definition || !definition.renderer.getConnectionPoint) {
      // Default connection point (center of element)
      return {
        x: element.bounds.x + element.bounds.width / 2,
        y: element.bounds.y + element.bounds.height / 2
      };
    }

    return definition.renderer.getConnectionPoint(element, reference, type);
  }

  /**
   * Check if two elements can be connected
   */
  canConnect(source: BPMNElement, target: BPMNElement): boolean {
    const sourceDefinition = this.components.get(source.type);
    if (!sourceDefinition?.connectionRules?.canConnect) {
      return true; // Default: allow all connections
    }

    return sourceDefinition.connectionRules.canConnect(source, target);
  }

  /**
   * Get palette items grouped by category
   */
  getPaletteItems(): Map<string, ComponentDefinition[]> {
    const palette = new Map<string, ComponentDefinition[]>();
    
    this.categories.forEach((types, category) => {
      const components = Array.from(types)
        .map(type => this.components.get(type))
        .filter(def => def !== undefined) as ComponentDefinition[];
      
      if (components.length > 0) {
        palette.set(category, components);
      }
    });

    return palette;
  }

  /**
   * Clear all registered components
   */
  clear(): void {
    this.components.clear();
    this.initializeCategories();
  }
}
