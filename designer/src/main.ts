import { BPMNDesigner } from './designer';
import './style.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const canvasContainer = document.getElementById('bpmn-canvas');
  
  if (!canvasContainer) {
    console.error('Canvas container not found');
    return;
  }
  
  // Create designer instance
  const designer = new BPMNDesigner(canvasContainer);
  
  // Initialize XML editor
  const xmlEditorContainer = document.getElementById('xml-editor');
  if (xmlEditorContainer) {
    designer.initXMLEditor(xmlEditorContainer);
  }
  
  // Expose designer to window for toolbar interactions and ElementRegistryUI
  (window as any).designer = designer;
  (window as any).bpmnDesigner = designer;
  
  // Setup toolbar events
  setupToolbar(designer);
  
  // Setup palette drag and drop
  setupPalette(designer);
});

function setupToolbar(designer: BPMNDesigner) {
  // Undo button
  const btnUndo = document.getElementById('btn-undo');
  if (btnUndo) {
    btnUndo.addEventListener('click', () => {
      designer.undo();
    });
  }
  
  // Redo button
  const btnRedo = document.getElementById('btn-redo');
  if (btnRedo) {
    btnRedo.addEventListener('click', () => {
      designer.redo();
    });
  }
  
  // BPMN.io owns the palette/modeling stack, so the old custom registry UI is hidden.
  const btnRegister = document.getElementById('btn-register-element');
  if (btnRegister) {
    btnRegister.style.display = 'none';
  }
  
  // Export SVG button
  const btnExport = document.getElementById('btn-export');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      designer.exportSVG();
    });
  }
  
  // Import BPMN button
  const btnImportBPMN = document.getElementById('btn-import-bpmn');
  if (btnImportBPMN) {
    btnImportBPMN.addEventListener('click', () => {
      designer.importBPMN();
    });
  }
  
  // Export BPMN button
  const btnExportBPMN = document.getElementById('btn-export-bpmn');
  if (btnExportBPMN) {
    btnExportBPMN.addEventListener('click', async () => {
      await designer.exportBPMN();
    });
  }
  
  // Configuration button
  const btnConfig = document.getElementById('btn-config');
  if (btnConfig) {
    btnConfig.addEventListener('click', () => {
      (designer as any).configPanel?.show();
    });
  }
  
  // Deploy button (label shows "Compile")
  const btnDeploy = document.getElementById('btn-deploy');
  if (btnDeploy) {
    btnDeploy.addEventListener('click', async () => {
      await (designer as any).handleDeploy();
    });
  }

  // Run Embedded button
  const btnRun = document.getElementById('btn-run-embedded');
  if (btnRun) {
    btnRun.addEventListener('click', async () => {
      await (designer as any).runEmbedded();
    });
  }

  // Galaxy button
  const btnGalaxy = document.getElementById('btn-galaxy');
  if (btnGalaxy) {
    btnGalaxy.addEventListener('click', () => {
      (designer as any).showGalaxyPanel();
    });
  }
  
  // View switcher buttons
  const btnDesignerView = document.getElementById('btn-designer-view');
  const btnXmlView = document.getElementById('btn-xml-view');
  
  if (btnDesignerView) {
    btnDesignerView.addEventListener('click', () => {
      designer.showDesigner();
      btnDesignerView.classList.add('active');
      btnXmlView?.classList.remove('active');
    });
  }
  
  if (btnXmlView) {
    btnXmlView.addEventListener('click', async () => {
      await designer.showXMLEditor();
      btnXmlView.classList.add('active');
      btnDesignerView?.classList.remove('active');
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

