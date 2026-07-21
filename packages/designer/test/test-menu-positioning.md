# Context Menu Positioning Test

## Expected Behavior

When clicking on any BPMN element, the context menu should:

1. **Appear outside the element boundary** - Not overlapping with the element
2. **Position to the right** - With a 5px gap from the element's right edge
3. **Vertically centered** - Aligned with the vertical center of the element
4. **Consistent positioning** - Same position regardless of where you click on the element

## Visual Example

```
Before (Issue):
┌─────────┐
│         │ <-- Click anywhere on element
│ Element ├──[Menu overlaps]
│         │
└─────────┘

After (Fixed):
┌─────────┐
│         │ <-- Click anywhere on element  
│ Element │  [Menu]  <-- 5px gap
│         │     ↑
└─────────┘     └── Appears outside boundary
```

## Implementation Details

### Position Calculation
```typescript
// Get element's screen dimensions
const scaleX = rect.width / viewBox.width;
const scaleY = rect.height / viewBox.height;

// Calculate actual screen size
const elementScreenWidth = element.width * scaleX;
const elementScreenHeight = element.height * scaleY;

// Position menu outside right boundary
const menuPosition = {
  x: elementScreenPos.x + elementScreenWidth + 5,  // 5px gap
  y: elementScreenPos.y + (elementScreenHeight / 2) // Centered
};
```

### Edge Case Handling

#### When element is near right edge:
- Menu appears on the **left side** of the element
- Still maintains 5px gap from element boundary

#### When element is near bottom:
- Menu adjusts upward to stay visible
- Maintains horizontal positioning rules

## Test Steps

1. **Create various elements** (Task, Gateway, Event)
2. **Click on different parts** of each element
3. **Verify menu appears** at the same position (right boundary + 5px)
4. **Test near edges**:
   - Place element near right edge → Menu should appear on left
   - Place element near bottom → Menu should adjust upward
5. **Test with zoom**:
   - Zoom in/out and verify menu still appears at correct position

## Technical Benefits

- **Predictable UX**: Users know where menu will appear
- **No overlap**: Menu never covers the element being operated on
- **Accessibility**: Clear visual separation between element and menu
- **Consistency**: Same behavior across all element types
