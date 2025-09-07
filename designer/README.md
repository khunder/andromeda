# BPMN Designer Library

A custom BPMN (Business Process Model and Notation) designer library built from scratch using TypeScript and pure SVG manipulation.

## Features

✨ **Built from Scratch** - No dependency on existing BPMN libraries (except bpmn-moddle for XML parsing)  
🎯 **Pure SVG Rendering** - Direct SVG manipulation for optimal performance  
🔄 **Dynamic Connections** - Auto-updating arrows when moving elements  
🎨 **Full BPMN Support** - Tasks, Events, Gateways, and Sequence Flows  
📦 **Two Versions Available**:
- TypeScript library for integration into applications
- Standalone HTML with pure JavaScript (no build required)

## Quick Start

### Option 1: Standalone Version (No Build Required)

Simply open `standalone.html` in any modern browser. This version includes:
- Complete BPMN designer functionality
- Pure JavaScript (no compilation needed)
- Drag & drop from palette
- Auto-updating connections
- Zoom and pan support
- Export to SVG

### Option 2: TypeScript Library

#### Installation

```bash
npm install
```

#### Development

```bash
npm run dev
```

This will start a development server at http://localhost:3000

#### Build

```bash
npm run build
```

## Project Structure

```
designer/
├── src/                    # TypeScript source code
│   ├── core/              # Core modules
│   │   ├── Canvas.ts      # SVG canvas management
│   │   └── EventBus.ts    # Event handling system
│   ├── renderer/          # Element renderers
│   │   ├── BaseRenderer.ts
│   │   ├── TaskRenderer.ts
│   │   ├── EventRenderer.ts
│   │   └── GatewayRenderer.ts
│   ├── types/             # TypeScript type definitions
│   ├── BPMNDesigner.ts    # Main designer class
│   └── index.ts           # Library entry point
├── demo/                  # Demo application
│   ├── index.html
│   └── index.ts
├── standalone.html        # Pure JavaScript version
└── dist/                  # Built library files
```

## Usage

### TypeScript/JavaScript

```typescript
import { BPMNDesigner } from 'bpmn-designer';

const designer = new BPMNDesigner({
  container: '#canvas-container'
});

// Add elements
designer.addElement({
  id: 'task1',
  type: BPMNElementType.USER_TASK,
  bounds: { x: 100, y: 100, width: 100, height: 80 },
  label: 'My Task'
});

// Add connections
designer.addConnection({
  id: 'flow1',
  source: 'task1',
  target: 'task2',
  type: ConnectionType.SEQUENCE_FLOW,
  waypoints: [...]
});
```

### Pure JavaScript (Standalone)

```javascript
const designer = new BPMNDesigner(document.getElementById('bpmn-canvas'));

// Add element
designer.addElement('userTask', 100, 100);

// Add connection
designer.addConnection(sourceId, targetId);
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
