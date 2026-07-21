# BPMN Designer - Advanced Features

## ✅ Implemented Features

### 1. **Click-based Context Menu** (Not Right-Click)
- **Regular click** on elements or connections shows context menu
- Different menu options based on what's clicked
- Canvas click shows options to add new elements

### 2. **Edge-based Connection Points**
- Connections now start/end at the **edge** of shapes, not center
- Proper intersection calculation for:
  - **Circles** - Point on circumference
  - **Rectangles** - Edge intersection
  - **Diamonds** - Diamond edge calculation

### 3. **Customizable Element System**
```typescript
// ElementDefinition allows full customization:
{
  type: 'customTask',
  shape: 'rectangle',
  style: {
    fill: '#e3f2fd',
    stroke: '#1976d2',
    strokeWidth: 2
  },
  icon: {
    type: 'svg',
    content: '<svg>...</svg>'
  },
  labelPosition: {
    position: 'center',
    offset: { x: 0, y: 0 }
  }
}
```

### 4. **Connection Selection & Editing**
- **Click on connections** to select them
- **Visible waypoints** appear when selected
- **Drag waypoints** to adjust connection path
- **Add/remove waypoints** via context menu
- **Change connection endpoints** by dragging start/end waypoints

### 5. **Advanced Connection Features**
- Thicker invisible click area for easier selection
- Connection highlighting when selected
- Connection labels (centered on path)
- Visual waypoint handles (blue circles)

### 6. **Element Registry System**
- Central registry for all element types
- Pre-defined elements with customizable:
  - Colors
  - Icons
  - Label positions
  - Connection rules
  - Shapes

### 7. **Label Positioning**
Elements support configurable label positions:
- `top`, `bottom`, `left`, `right`, `center`
- Custom offsets for fine-tuning

## 🎮 How to Use New Features

### Selecting & Editing Connections
1. **Click** on any connection line to select it
2. Blue waypoint handles appear
3. **Drag handles** to adjust the connection path
4. **Context menu** options:
   - Add Waypoint
   - Delete Connection
   - Properties

### Customizing Elements
Elements now have customizable:
- **Fill color** - Background color
- **Stroke color** - Border color
- **Stroke width** - Border thickness
- **Icons** - SVG, text, or image icons
- **Label position** - Where the label appears

### Connection Rules
- Connections automatically connect to shape edges
- Smart routing based on element positions
- Validation prevents invalid connections

## 🏗️ Architecture Components

### New Classes Added:
1. **`ElementDefinition.ts`** - Element type definitions
2. **`ElementRegistry`** - Manages element types
3. **`ConnectionEditor`** - Handles connection editing
4. **Improved `ConnectionManager`** - Edge-based calculations

### Enhanced Features:
- **Renderer** - Now supports clickable connections
- **BPMNDesigner** - Integrated all new features
- **ContextMenu** - Shows on regular click

## 📝 Element Definition Example

```typescript
elementRegistry.register({
  type: 'apiTask',
  category: 'task',
  label: 'API Task',
  shape: 'rectangle',
  defaultSize: { width: 120, height: 80 },
  style: {
    fill: '#e8f5e9',
    stroke: '#4caf50',
    strokeWidth: 2,
    borderRadius: 8
  },
  icon: {
    type: 'text',
    content: 'API',
    position: { x: 5, y: 5 },
    size: { width: 30, height: 20 }
  },
  labelPosition: {
    position: 'bottom',
    offset: { x: 0, y: 10 }
  },
  allowIncoming: true,
  allowOutgoing: true
});
```

## 🚀 Next Steps

To complete all requested features, you can:

### 1. **Add UI for Element Registration**
Create a form to dynamically add new element types

### 2. **Property Editor Panel**
Update the properties panel to edit:
- Element colors
- Label text and position
- Icon selection
- Connection properties

### 3. **Enhanced Label Editing**
- In-place label editing
- Font size/style options
- Multi-line labels

### 4. **Connection Styling**
- Different line styles (solid, dashed, dotted)
- Connection colors
- Arrow styles

## 💡 Usage Tips

- **Click** (not right-click) to access menus
- **Shift+Drag** to create connections
- **Click connections** to edit waypoints
- **Drag waypoints** to reshape connections
- **Elements connect at edges**, not centers

The system is now highly extensible and customizable!
