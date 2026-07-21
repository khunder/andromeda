# BPMN Designer - Feature Demo

## 🎯 Key Features Implemented

### 1. **Element Selection** ✅
- **Click** on any element to select it
- Selection is shown with a blue dashed border
- Selection now works properly (fixed the drag interference issue)

### 2. **Context Menu** (like bpmn.io) ✅
- **Right-click** on any element to see context menu
- Options include:
  - **Connect to...** - Start drawing a connection
  - **Delete** - Remove the element
  - **Properties** - View element properties
- Right-click on empty canvas for quick add options

### 3. **Connection Drawing with Validation** ✅
- **Two ways to create connections:**
  1. **Shift + Drag** from source element to target
  2. **Right-click** → "Connect to..." from context menu
  
- **Visual Feedback:**
  - Blue dashed line while drawing
  - **Green circle** = Valid connection target
  - **Red circle** = Invalid connection target
  - Connection snaps to target center when valid

### 4. **BPMN Connection Rules** ✅
Enforced connection validation based on BPMN 2.0 specification:
- ✅ **Start Events** → Tasks, Gateways
- ✅ **Tasks** → Tasks, Gateways, End Events
- ✅ **Gateways** → Tasks, Gateways, End Events
- ❌ **End Events** → Nothing (cannot have outgoing connections)
- ❌ **Start Events** cannot have incoming connections
- ❌ Elements cannot connect to themselves

### 5. **BPMN XML Export/Import** ✅
- Click **"Export BPMN XML"** button (green) to download `.bpmn` file
- Exported XML includes:
  - All BPMN 2.0 standard elements
  - Proper namespace declarations
  - Diagram information (positions, sizes)
  - Script task properties (language, script content)
  - Sequence flow connections

### 6. **Drag & Drop with Shadow** ✅
- Drag elements to move them
- **Shadow effect** shows:
  - Original position of element (semi-transparent)
  - Original connections as dashed lines
  - Helps visualize the move operation

## 🎮 How to Use

### Basic Operations
| Action | How to |
|--------|--------|
| **Add Element** | Drag from left palette |
| **Select Element** | Click on element |
| **Move Element** | Drag element (see shadow) |
| **Delete Element** | Select + Delete button OR Right-click → Delete |
| **Zoom** | Mouse wheel OR zoom buttons |

### Creating Connections
1. **Method 1: Shift + Drag**
   - Hold Shift
   - Click and drag from source element
   - Release on target element
   - Green indicator = valid, Red = invalid

2. **Method 2: Context Menu**
   - Right-click source element
   - Select "Connect to..."
   - Click on target element

### Keyboard Shortcuts
- **Escape** - Cancel current operation (connection drawing)
- **Delete** - Delete selected element (when implemented)

## 📋 BPMN XML Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <process id="Process_abc123" isExecutable="true">
    <startEvent id="element_1" name="Start Event"/>
    <userTask id="element_2" name="User Task"/>
    <scriptTask id="element_3" name="Script Task" scriptFormat="javascript">
      <script>console.log('Hello BPMN!');</script>
    </scriptTask>
    <endEvent id="element_4" name="End Event"/>
    <sequenceFlow id="connection_1" sourceRef="element_1" targetRef="element_2"/>
    <sequenceFlow id="connection_2" sourceRef="element_2" targetRef="element_3"/>
    <sequenceFlow id="connection_3" sourceRef="element_3" targetRef="element_4"/>
  </process>
</definitions>
```

## 🏗️ Architecture Highlights

### Clean Separation of Concerns
- **BPMNDesigner** - Main orchestrator
- **ElementManager** - Element CRUD operations
- **ConnectionManager** - Connection management
- **ConnectionValidator** - BPMN rule enforcement
- **ConnectionHandler** - Interactive connection drawing
- **ContextMenu** - Right-click menu system
- **DragHandler** - Drag operations with shadows
- **Renderer** - SVG rendering engine
- **BPMNExporter** - XML import/export

### TypeScript Benefits
- Full type safety
- IntelliSense support
- Compile-time error checking
- Better maintainability

## 🚀 Future Enhancements
- [ ] Properties panel with live editing
- [ ] Undo/Redo functionality
- [ ] Copy/Paste elements
- [ ] Keyboard shortcuts
- [ ] Subprocess support
- [ ] Data objects and stores
- [ ] Boundary events
- [ ] Message flows
- [ ] Pools and lanes
- [ ] BPMN validation warnings
