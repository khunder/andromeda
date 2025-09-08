# Context Menu Behavior Update

## Changes Made

### Previous Behavior (Issues)
- **Left-click** on element → Shows context menu ❌
- **Left-click** on canvas → Shows context menu ❌
- **Left-click** on connection → Shows context menu ❌
- Menus appearing unexpectedly during normal selection

### New Behavior (Fixed)
- **Left-click** on element → Selects element only (no menu) ✅
- **Left-click** on canvas → Clears selection only (no menu) ✅
- **Left-click** on connection → Selects connection only (no menu) ✅
- **Right-click** on element → Shows element context menu ✅
- **Right-click** on canvas → Shows canvas context menu ✅
- **Right-click** on connection → Shows connection context menu ✅

## User Interaction Guide

### Left-Click (Selection Only)
| Target | Action | Result |
|--------|--------|--------|
| Element | Left-click | Selects element, shows properties panel |
| Connection | Left-click | Selects connection, shows waypoints |
| Empty Canvas | Left-click | Clears any selection |

### Right-Click (Context Menu)
| Target | Action | Menu Options |
|--------|--------|--------------|
| Element | Right-click | • Connect to...<br>• Delete<br>• Properties |
| Connection | Right-click | • Add Waypoint<br>• Delete Connection<br>• Properties |
| Empty Canvas | Right-click | • Add User Task<br>• Add Gateway |

## Benefits

### Improved UX
- **Predictable**: Standard right-click behavior across all applications
- **Clean**: Left-click for selection, right-click for actions
- **Non-intrusive**: Menus only appear when explicitly requested

### Workflow Efficiency
- **Quick selection**: Left-click to select without menu interference
- **Fast navigation**: Click through elements without popup interruptions
- **Intentional actions**: Right-click when you need actions

## Implementation Details

### Code Structure
```typescript
// Left-click handler - Selection only
svg.addEventListener('click', (e) => {
  // Select element or connection
  // Clear selection if clicking canvas
  // No menu shown
});

// Right-click handler - Context menu
svg.addEventListener('contextmenu', (e) => {
  e.preventDefault(); // Prevent browser menu
  // Select and show appropriate context menu
});
```

### Event Flow
1. **Left-click Detection**
   - Identifies target (element/connection/canvas)
   - Updates selection state
   - Updates properties panel if needed
   - No menu display

2. **Right-click Detection**
   - Prevents default browser context menu
   - Identifies target
   - Selects target (if element/connection)
   - Shows appropriate context menu

## Testing Checklist

### Left-Click Tests
- [ ] Click element → Element selected, no menu
- [ ] Click connection → Connection selected, waypoints shown, no menu
- [ ] Click canvas → Selection cleared, no menu
- [ ] Click different elements rapidly → Smooth selection changes

### Right-Click Tests
- [ ] Right-click element → Element menu appears
- [ ] Right-click connection → Connection menu appears
- [ ] Right-click canvas → Canvas menu appears
- [ ] Right-click near edge → Menu repositions correctly

### Combined Tests
- [ ] Left-click element, then right-click → Selection maintained, menu shown
- [ ] Right-click element A, then left-click element B → Menu hidden, B selected
- [ ] Multiple right-clicks → Previous menu replaced with new one

## Keyboard Integration

The context menu behavior works seamlessly with keyboard shortcuts:
- Select with left-click → Press `Delete` → Element deleted (no menu needed)
- Right-click for menu → Choose Delete → Same result with visual confirmation

## User Experience Philosophy

This implementation follows standard desktop application patterns:
- **Left-click** = Primary action (select)
- **Right-click** = Secondary actions (context menu)
- **Double-click** = (Reserved for future: edit labels inline)
- **Drag** = Move or connect

This separation of concerns makes the application more intuitive and reduces accidental menu triggers during normal workflow operations.
