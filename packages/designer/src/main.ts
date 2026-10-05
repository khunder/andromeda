import { BPMNDesigner } from './designer';
import { BPMN_EXAMPLES } from './designer/examples';
import { showToast } from './designer/Toast';
import { Workspace } from './layout/Workspace';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import './vendor/dockview.css';
// after the library styles so the glass theme wins over them
import './style.css';

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const canvasContainer = document.getElementById('bpmn-canvas');
  const dockRoot = document.getElementById('dock');
  const panelSources = document.getElementById('panel-sources');
  const sideMenu = document.querySelector<HTMLElement>('.side-menu');

  if (!canvasContainer || !dockRoot || !panelSources || !sideMenu) {
    console.error('Designer layout elements not found');
    return;
  }

  // Lay out the dock first, so bpmn-js is created on a visible canvas
  const workspace = new Workspace(dockRoot, panelSources, sideMenu);
  workspace.init();

  // Create designer instance
  const designer = new BPMNDesigner(canvasContainer);

  // Initialize XML editor
  const xmlEditorContainer = document.getElementById('xml-editor');
  if (xmlEditorContainer) {
    designer.initXMLEditor(xmlEditorContainer);
  }

  workspace.attachDesigner(designer);

  // Expose designer to window for toolbar interactions and ElementRegistryUI
  (window as any).designer = designer;
  (window as any).bpmnDesigner = designer;
  (window as any).workspace = workspace;

  // Setup toolbar events
  setupToolbar(designer, workspace);

  // Setup palette drag and drop
  setupPalette(designer);
});

function setupToolbar(designer: BPMNDesigner, workspace: Workspace) {
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
  
  // Examples dropdown - loads one of the engine's test scenario diagrams
  const examplesSelect = document.getElementById('examples-select') as HTMLSelectElement | null;
  if (examplesSelect) {
    for (const example of BPMN_EXAMPLES) {
      const option = document.createElement('option');
      option.value = example.path;
      option.textContent = example.label;
      option.title = example.path;
      examplesSelect.appendChild(option);
    }
    examplesSelect.addEventListener('change', async () => {
      const example = BPMN_EXAMPLES.find(e => e.path === examplesSelect.value);
      if (example) {
        try {
          await designer.importFromXML(example.xml);
          showToast(`Loaded example: ${example.label}`, 'success');
        } catch (error) {
          console.error(`Error loading example ${example.path}:`, error);
          showToast(`Could not load example ${example.label}`, 'error');
        }
      }
      // reset so the same example can be picked again
      examplesSelect.value = '';
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
      designer.showConfiguration();
    });
  }
  
  // Compile button - compiles the BPMN diagram into a generated container
  const btnCompile = document.getElementById('btn-compile');
  if (btnCompile) {
    btnCompile.addEventListener('click', async () => {
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

  // Galaxy, Diagram, XML and Properties are opened from the left menu (Workspace)
  const btnResetLayout = document.getElementById('btn-reset-layout');
  if (btnResetLayout) {
    btnResetLayout.addEventListener('click', () => {
      workspace.resetLayout();
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

