import { BPMNDesigner } from './designer';
import { ElementRegistryUI } from './designer/ElementRegistryUI';
import './style.css';

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const canvasContainer = document.getElementById('bpmn-canvas');
  
  if (!canvasContainer) {
    console.error('Canvas container not found');
    return;
  }
  
  // Create designer instance
  const designer = new BPMNDesigner(canvasContainer);
  
  // Expose designer to window for toolbar interactions
  (window as any).designer = designer;
  
  // Setup toolbar events
  setupToolbar(designer);
  
  // Setup palette drag and drop
  setupPalette(designer);
});

function setupToolbar(designer: BPMNDesigner) {
  // Register element button
  const btnRegister = document.getElementById('btn-register-element');
  if (btnRegister) {
    btnRegister.addEventListener('click', () => {
      const registryUI = new ElementRegistryUI(
        designer.getElementRegistry(),
        () => {
          // Refresh palette event handlers
          setupPalette(designer);
        }
      );
      registryUI.show();
    });
  }
  
  // Clear button
  const btnClear = document.getElementById('btn-clear');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (confirm('Clear all elements?')) {
        designer.clear();
      }
    });
  }
  
  // Delete button
  const btnDelete = document.getElementById('btn-delete');
  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      designer.deleteSelected();
    });
  }
  
  // Export SVG button
  const btnExport = document.getElementById('btn-export');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      designer.exportSVG();
    });
  }
  
  // Export BPMN button (add to HTML)
  const btnExportBPMN = document.getElementById('btn-export-bpmn');
  if (btnExportBPMN) {
    btnExportBPMN.addEventListener('click', () => {
      designer.exportBPMN();
    });
  }
  
  // Zoom controls
  const btnZoomIn = document.getElementById('btn-zoom-in');
  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      designer.setZoom(designer.getZoom() * 1.2);
    });
  }
  
  const btnZoomOut = document.getElementById('btn-zoom-out');
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      designer.setZoom(designer.getZoom() / 1.2);
    });
  }
  
  const btnZoomReset = document.getElementById('btn-zoom-reset');
  if (btnZoomReset) {
    btnZoomReset.addEventListener('click', () => {
      designer.setZoom(1);
    });
  }
}

function setupPalette(designer: BPMNDesigner) {
  let draggedType: string | null = null;
  
  // Setup drag from palette items
  document.querySelectorAll('.palette-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      const target = e.target as HTMLElement;
      draggedType = target.getAttribute('data-element-type');
    });
  });
  
  // Setup drop on canvas container
  const canvasContainer = document.getElementById('canvas-container');
  if (canvasContainer) {
    canvasContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    
    canvasContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      
      if (draggedType) {
        const rect = canvasContainer.getBoundingClientRect();
        const svg = canvasContainer.querySelector('svg');
        
        if (svg) {
          const viewBox = svg.viewBox.baseVal;
          const scaleX = viewBox.width / rect.width;
          const scaleY = viewBox.height / rect.height;
          
          const x = viewBox.x + (e.clientX - rect.left) * scaleX;
          const y = viewBox.y + (e.clientY - rect.top) * scaleY;
          
          // Adjust position based on element type
          let adjustedX = x - 50;
          let adjustedY = y - 40;
          
          if (draggedType.includes('Event')) {
            adjustedX = x - 18;
            adjustedY = y - 18;
          } else if (draggedType.includes('Gateway')) {
            adjustedX = x - 25;
            adjustedY = y - 25;
          }
          
          designer.addElement(draggedType, adjustedX, adjustedY);
          draggedType = null;
        }
      }
    });
  }
}

// Export designer class for use in other modules
export { BPMNDesigner };
