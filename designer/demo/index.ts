// Demo application for the BPMN Designer

import { BPMNDesigner, BPMNElement, BPMNElementType, ConnectionType } from '../src';

// Initialize the designer
const designer = new BPMNDesigner({
  container: '#canvas-container'
});

// Create a sample process
function createSampleProcess() {
  // Clear existing elements
  designer['elements'].clear();
  designer['connections'].clear();

  // Add start event
  const startEvent: BPMNElement = {
    id: 'start1',
    type: BPMNElementType.START_EVENT,
    bounds: { x: 100, y: 200, width: 36, height: 36 },
    label: 'Start'
  };
  designer.addElement(startEvent);

  // Add first task
  const task1: BPMNElement = {
    id: 'task1',
    type: BPMNElementType.USER_TASK,
    bounds: { x: 200, y: 180, width: 100, height: 80 },
    label: 'Review Request'
  };
  designer.addElement(task1);

  // Add gateway
  const gateway: BPMNElement = {
    id: 'gateway1',
    type: BPMNElementType.EXCLUSIVE_GATEWAY,
    bounds: { x: 350, y: 190, width: 50, height: 50 },
    label: 'Approved?'
  };
  designer.addElement(gateway);

  // Add approval task
  const task2: BPMNElement = {
    id: 'task2',
    type: BPMNElementType.SERVICE_TASK,
    bounds: { x: 450, y: 130, width: 100, height: 80 },
    label: 'Process Request'
  };
  designer.addElement(task2);

  // Add rejection task
  const task3: BPMNElement = {
    id: 'task3',
    type: BPMNElementType.SEND_TASK,
    bounds: { x: 450, y: 250, width: 100, height: 80 },
    label: 'Send Rejection'
  };
  designer.addElement(task3);

  // Add end events
  const endEvent1: BPMNElement = {
    id: 'end1',
    type: BPMNElementType.END_EVENT,
    bounds: { x: 600, y: 150, width: 36, height: 36 },
    label: 'Success'
  };
  designer.addElement(endEvent1);

  const endEvent2: BPMNElement = {
    id: 'end2',
    type: BPMNElementType.END_EVENT,
    bounds: { x: 600, y: 270, width: 36, height: 36 },
    label: 'Rejected'
  };
  designer.addElement(endEvent2);

  // Add connections
  designer.addConnection({
    id: 'flow1',
    source: 'start1',
    target: 'task1',
    type: ConnectionType.SEQUENCE_FLOW,
    waypoints: [
      { x: 136, y: 218 },
      { x: 200, y: 220 }
    ]
  });

  designer.addConnection({
    id: 'flow2',
    source: 'task1',
    target: 'gateway1',
    type: ConnectionType.SEQUENCE_FLOW,
    waypoints: [
      { x: 300, y: 220 },
      { x: 350, y: 215 }
    ]
  });

  designer.addConnection({
    id: 'flow3',
    source: 'gateway1',
    target: 'task2',
    type: ConnectionType.SEQUENCE_FLOW,
    waypoints: [
      { x: 400, y: 200 },
      { x: 450, y: 170 }
    ]
  });

  designer.addConnection({
    id: 'flow4',
    source: 'gateway1',
    target: 'task3',
    type: ConnectionType.SEQUENCE_FLOW,
    waypoints: [
      { x: 400, y: 230 },
      { x: 450, y: 290 }
    ]
  });

  designer.addConnection({
    id: 'flow5',
    source: 'task2',
    target: 'end1',
    type: ConnectionType.SEQUENCE_FLOW,
    waypoints: [
      { x: 550, y: 170 },
      { x: 600, y: 168 }
    ]
  });

  designer.addConnection({
    id: 'flow6',
    source: 'task3',
    target: 'end2',
    type: ConnectionType.SEQUENCE_FLOW,
    waypoints: [
      { x: 550, y: 290 },
      { x: 600, y: 288 }
    ]
  });

  designer.fitToViewport();
}

// Setup toolbar buttons
document.getElementById('btn-new')?.addEventListener('click', () => {
  if (confirm('Create a new diagram? This will clear the current diagram.')) {
    designer['elements'].clear();
    designer['connections'].clear();
    designer['render']();
  }
});

document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
  designer.zoomIn();
});

document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
  designer.zoomOut();
});

document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
  designer.getCanvas().setZoom(1);
});

document.getElementById('btn-fit')?.addEventListener('click', () => {
  designer.fitToViewport();
});

document.getElementById('btn-delete')?.addEventListener('click', () => {
  const selectedElement = designer['selectedElement'];
  if (selectedElement) {
    designer.removeElement(selectedElement);
  }
});

// Setup palette drag and drop
let draggedType: BPMNElementType | null = null;

document.querySelectorAll('.palette-item').forEach(item => {
  item.addEventListener('dragstart', (e) => {
    const element = e.target as HTMLElement;
    draggedType = element.getAttribute('data-element-type') as BPMNElementType;
  });
});

const canvasContainer = document.getElementById('canvas-container');
if (canvasContainer) {
  canvasContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  });

  canvasContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedType) {
      const svgPoint = designer.getCanvas().screenToSVG({
        x: e.clientX,
        y: e.clientY
      });

      const id = `${draggedType}_${Date.now()}`;
      let bounds = { x: svgPoint.x - 50, y: svgPoint.y - 40, width: 100, height: 80 };
      
      // Adjust bounds based on element type
      if (draggedType.includes('Event')) {
        bounds = { x: svgPoint.x - 18, y: svgPoint.y - 18, width: 36, height: 36 };
      } else if (draggedType.includes('Gateway')) {
        bounds = { x: svgPoint.x - 25, y: svgPoint.y - 25, width: 50, height: 50 };
      }

      const newElement: BPMNElement = {
        id,
        type: draggedType,
        bounds,
        label: draggedType.replace(/([A-Z])/g, ' $1').trim()
      };

      designer.addElement(newElement);
      draggedType = null;
    }
  });
}

// Setup properties panel
designer.getEventBus().on('element.selected', (event) => {
  const elementId = event.data.elementId;
  const element = designer['elements'].get(elementId);
  
  if (element) {
    const propertiesContent = document.getElementById('properties-content');
    if (propertiesContent) {
      propertiesContent.innerHTML = `
        <div class="property-group">
          <label>ID</label>
          <input type="text" value="${element.id}" readonly>
        </div>
        <div class="property-group">
          <label>Type</label>
          <input type="text" value="${element.type}" readonly>
        </div>
        <div class="property-group">
          <label>Label</label>
          <input type="text" id="element-label" value="${element.label || ''}">
        </div>
        <div class="property-group">
          <label>Position</label>
          <input type="text" value="X: ${Math.round(element.bounds.x)}, Y: ${Math.round(element.bounds.y)}" readonly>
        </div>
        <div class="property-group">
          <label>Size</label>
          <input type="text" value="W: ${element.bounds.width}, H: ${element.bounds.height}" readonly>
        </div>
      `;

      // Update label on change
      const labelInput = document.getElementById('element-label') as HTMLInputElement;
      if (labelInput) {
        labelInput.addEventListener('input', () => {
          element.label = labelInput.value;
          designer['render']();
        });
      }
    }
  }
});

designer.getEventBus().on('selection.cleared', () => {
  const propertiesContent = document.getElementById('properties-content');
  if (propertiesContent) {
    propertiesContent.innerHTML = '<p style="color: #999;">Select an element to view properties</p>';
  }
});

// Make palette items draggable
document.querySelectorAll('.palette-item').forEach(item => {
  (item as HTMLElement).draggable = true;
});

// Initialize with sample process
createSampleProcess();

// Export for debugging
(window as any).designer = designer;
