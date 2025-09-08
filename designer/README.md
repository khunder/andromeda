# BPMN Designer Library

An extensible, customizable BPMN designer library with dynamic component registration and JavaScript execution support.

## Features

✨ **Extensible Architecture** - Register custom components dynamically  
🔌 **Plugin System** - Add new components and behaviors via plugins  
📜 **Script Task Support** - Execute JavaScript code within BPMN processes  
📝 **BPMN XML Export/Import** - Full BPMN 2.0 XML support  
🎯 **Component Customization** - Every component is fully customizable  
🔄 **Smart Connections** - Auto-updating arrows when moving elements  
⚡ **TypeScript Support** - Full type safety and IntelliSense  
🎨 **Pure SVG Rendering** - Optimal performance with native SVG

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:3000 in your browser.

### Production Build

```bash
npm run build
```

The built files will be in the `dist` folder.

### Direct Usage

You can also just open `index.html` directly in a browser without any build process - it's pure JavaScript!

## Project Structure

```
bpmn-designer/
├── index.html             # Main BPMN Designer application
├── vite.config.js         # Vite configuration
├── package.json           # Dependencies (only Vite for dev server)
├── README.md              # Documentation
└── dist/                  # Production build (created after build)
```

## How It Works

The entire BPMN designer is contained in a single `index.html` file with embedded JavaScript. No compilation or build step is required for development - you can edit and see changes immediately.

## Usage

### Register Custom Components

```typescript
import { ComponentRegistry, ComponentDefinition } from 'bpmn-designer';

const registry = new ComponentRegistry();

// Register a custom component
const customComponent: ComponentDefinition = {
  type: 'customTask',
  category: 'task',
  label: 'Custom Task',
  defaultSize: { width: 120, height: 80 },
  properties: [
    {
      name: 'apiUrl',
      label: 'API URL',
      type: 'string',
      default: 'https://api.example.com'
    }
  ],
  renderer: {
    render(element, container) {
      // Custom SVG rendering logic
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      // ... render your custom element
      return g;
    }
  },
  behavior: {
    async onExecute(element, context) {
      // Custom execution logic
      const response = await fetch(element.properties.apiUrl);
      return response.json();
    }
  }
};

registry.register(customComponent);
```

### Script Task with JavaScript

```typescript
import { ScriptTaskComponent } from 'bpmn-designer';

// Script task executes JavaScript code
const scriptElement = {
  type: 'scriptTask',
  properties: {
    scriptLanguage: 'javascript',
    script: `
      // Access process variables
      const orderId = variables.get('orderId');
      
      // Use services
      const result = await services.get('orderService').process(orderId);
      
      // Log execution
      logger.log('Order processed:', result);
      
      // Return value
      return { processed: true, orderId };
    `,
    resultVariable: 'scriptResult'
  }
};
```

### Export/Import BPMN XML

```typescript
import { BPMNExporter } from 'bpmn-designer';

const exporter = new BPMNExporter();

// Export to BPMN XML
const xml = await exporter.exportToXML(elements, connections);
console.log(xml); // Standard BPMN 2.0 XML

// Import from BPMN XML
const { elements, connections } = await exporter.importFromXML(xml);
```

## Supported BPMN Elements

### Events
- Start Event
- End Event
- Intermediate Events
- Boundary Events

### Activities
- User Task
- Service Task
- Script Task
- Business Rule Task
- Send Task
- Receive Task
- Manual Task

### Gateways
- Exclusive Gateway (XOR)
- Parallel Gateway (AND)
- Inclusive Gateway (OR)
- Event-based Gateway
- Complex Gateway

### Flows
- Sequence Flow
- Message Flow
- Association

## Key Features Implementation

### Auto-updating Connections
Connections automatically adjust when elements are moved, maintaining proper attachment points based on element shapes:
- **Circles (Events)**: Connect at the edge based on angle
- **Diamonds (Gateways)**: Connect to corner points
- **Rectangles (Tasks)**: Connect to edge midpoints

### Zoom and Pan
- Mouse wheel for zooming
- Middle mouse button or Ctrl+drag for panning
- Programmatic zoom controls

### Drag and Drop
- Drag elements from palette to create
- Drag existing elements to reposition
- Connections follow automatically

## API Reference

### BPMNDesigner

Main class for the designer.

#### Constructor
```typescript
new BPMNDesigner(options: ModelerOptions | ViewerOptions)
```

#### Methods
- `addElement(element: BPMNElement): void`
- `removeElement(elementId: string): void`
- `addConnection(connection: Connection): void`
- `removeConnection(connectionId: string): void`
- `importXML(xml: string): Promise<void>`
- `exportXML(): Promise<string>`
- `zoomIn(): void`
- `zoomOut(): void`
- `fitToViewport(): void`

### Events

The designer emits various events through the EventBus:

- `element.added`
- `element.removed`
- `element.selected`
- `connection.added`
- `connection.removed`
- `canvas.zoom`

## Development

### Prerequisites
- Node.js 14+
- npm or yarn

### Commands
- `npm run dev` - Start development server
- `npm run build` - Build the library
- `npm run build:demo` - Build demo for production

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Future Enhancements

- [ ] Pools and Lanes support
- [ ] Sub-processes
- [ ] Data objects and stores
- [ ] Annotations
- [ ] BPMN 2.0 XML import/export (currently using bpmn-moddle)
- [ ] Orthogonal routing for connections
- [ ] Undo/Redo functionality
- [ ] Copy/Paste support
- [ ] Keyboard shortcuts
- [ ] Touch device support
- [ ] Custom properties panel
- [ ] Validation rules
- [ ] Auto-layout algorithms
- [ ] Collaborative editing
