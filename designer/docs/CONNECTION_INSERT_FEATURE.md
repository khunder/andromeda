# Connection Insert Feature

## Overview
The BPMN Designer now supports inserting nodes directly onto existing connections by dragging and dropping from the palette. This feature makes it easy to add intermediate steps between already connected elements.

## How It Works

### User Interaction
1. **Drag** an element from the palette (e.g., Script Task, User Task, Gateway)
2. **Hover** over an existing connection line - the line will highlight in green with a pulsing animation
3. **Drop** the element on the highlighted connection
4. The new element is inserted between the connected elements, automatically creating two new connections

### Visual Feedback
- **Green highlight** appears when hovering over a valid connection
- **Pulsing animation** (stroke width animates from 4px to 6px) indicates drop zone
- Highlight clears when moving away from connections

## Technical Implementation

### Components

#### ConnectionInsertHandler
- **Location**: `src/designer/ConnectionInsertHandler.ts`
- **Purpose**: Manages the connection insertion logic
- **Key Methods**:
  - `checkConnectionProximity()`: Detects if cursor is near a connection (15px threshold)
  - `highlightConnection()`: Creates visual feedback for valid drop zones
  - `insertNodeOnConnection()`: Performs the actual insertion operation
  - `canInsertBetween()`: Validates if an element type can be inserted between two nodes

#### Integration in BPMNDesigner
- Drag and drop event handlers added to palette items
- SVG canvas listens for dragover and drop events
- Connection proximity checking during drag operations
- Automatic waypoint calculation for new connections

### Business Rules
The following rules determine valid insertions:

1. **Tasks** (User, Service, Script):
   - ✅ Can be inserted between most elements
   - ❌ Cannot be inserted after End Events
   - ❌ Cannot be inserted before Start Events

2. **Gateways** (Exclusive, Parallel):
   - ✅ Can be inserted between tasks and other gateways
   - ❌ Cannot be inserted after End Events
   - ❌ Cannot be inserted before Start Events

3. **Events**:
   - ❌ Generally cannot be inserted on connections
   - Events should be placed independently on the canvas

## Algorithm

### Distance Calculation
The system uses point-to-line-segment distance calculation:
```typescript
// For each connection segment, calculate perpendicular distance
// If distance < 15 pixels, connection is considered "near"
pointToSegmentDistance(mousePoint, segmentStart, segmentEnd)
```

### Insertion Process
1. Store the original connection's source and target
2. Delete the original connection
3. Create new element at drop position
4. Create connection from source to new element
5. Create connection from new element to target
6. Recalculate waypoints for optimal routing

## Example Workflow

### Before Insertion
```
[Start Event] ──────────> [End Event]
```

### During Drag (Script Task over connection)
```
[Start Event] ═══green═══> [End Event]
                  ↑
            [Script Task]
```

### After Drop
```
[Start Event] ──> [Script Task] ──> [End Event]
```

## Benefits
- **Faster workflow**: No need to delete and recreate connections manually
- **Intuitive**: Natural drag-and-drop interaction
- **Visual feedback**: Clear indication of where elements will be inserted
- **Smart validation**: Only allows valid insertions based on BPMN rules

## Testing
A test file is provided at `test/test-connection-insert.ts` that validates:
- Connection proximity detection
- Element insertion logic
- Connection splitting and recreation
- Business rule enforcement

## Future Enhancements
- Support for inserting multiple elements at once
- Keyboard shortcuts for quick insertion
- Undo/redo support for insertion operations
- Animation during insertion for smoother UX
