// Event Bus for handling events across the application

export type EventHandler = (event: any) => void;

export class EventBus {
  private events: Map<string, Set<EventHandler>>;
  private onceHandlers: Map<string, Set<EventHandler>>;

  constructor() {
    this.events = new Map();
    this.onceHandlers = new Map();
  }

  on(event: string, handler: EventHandler): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);
  }

  once(event: string, handler: EventHandler): void {
    if (!this.onceHandlers.has(event)) {
      this.onceHandlers.set(event, new Set());
    }
    this.onceHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.events.delete(event);
      }
    }
    
    const onceHandlers = this.onceHandlers.get(event);
    if (onceHandlers) {
      onceHandlers.delete(handler);
      if (onceHandlers.size === 0) {
        this.onceHandlers.delete(event);
      }
    }
  }

  emit(event: string, data?: any): void {
    const eventData = {
      type: event,
      data,
      timestamp: Date.now()
    };

    // Handle regular handlers
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(eventData);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }

    // Handle once handlers
    const onceHandlers = this.onceHandlers.get(event);
    if (onceHandlers) {
      onceHandlers.forEach(handler => {
        try {
          handler(eventData);
        } catch (error) {
          console.error(`Error in once handler for ${event}:`, error);
        }
      });
      this.onceHandlers.delete(event);
    }
  }

  clear(): void {
    this.events.clear();
    this.onceHandlers.clear();
  }
}
