import Modeler from 'bpmn-js/lib/Modeler';
import { ElementRegistry } from './ElementDefinition';
import { ConfigurationManager } from './ConfigurationManager';
import { ConfigurationPanel } from './ConfigurationPanel';
import { DeploymentService } from './DeploymentService';
import { loadMonaco } from './MonacoLoader';
import './GalaxyModal';
import type { GalaxyModal } from './GalaxyModal';

declare const monaco: any;

const EMPTY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="wee" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:itemDefinition id="ItemDefinition_age" structureRef="number" />
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:property id="Property_age" itemSubjectRef="ItemDefinition_age" name="age" />
    <bpmn:startEvent id="StartEvent_1" name="Start">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:scriptTask id="ScriptTask_1" name="age23" scriptFormat="javascript">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
      <bpmn:script>console.log("-----&gt;");
this.variables.age = 23;
</bpmn:script>
    </bpmn:scriptTask>
    <bpmn:endEvent id="EndEvent_1" name="End">
      <bpmn:incoming>Flow_0rwn1un</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="ScriptTask_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="ScriptTask_1" targetRef="Activity_05rjq3s" />
    <bpmn:scriptTask id="Activity_05rjq3s" name="age25">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_0rwn1un</bpmn:outgoing>
      <bpmn:script>console.log("Step 2 -----&gt; changing age to 25");
this.variables.age = 25;</bpmn:script>
    </bpmn:scriptTask>
    <bpmn:sequenceFlow id="Flow_0rwn1un" sourceRef="Activity_05rjq3s" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="156" y="96" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ScriptTask_1_di" bpmnElement="ScriptTask_1">
        <dc:Bounds x="260" y="74" width="100" height="80" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="622" y="96" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="630" y="132" width="20" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Activity_05rjq3s_di" bpmnElement="Activity_05rjq3s">
        <dc:Bounds x="450" y="74" width="100" height="80" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="192" y="114" />
        <di:waypoint x="260" y="114" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="360" y="114" />
        <di:waypoint x="450" y="114" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0rwn1un_di" bpmnElement="Flow_0rwn1un">
        <di:waypoint x="550" y="114" />
        <di:waypoint x="622" y="114" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;

type BpmnModeler = Modeler<Record<string, unknown>>;

type AllowedBpmnElement = {
  key: string;
  label: string;
  bpmnType: string;
  paletteClass: string;
  group: string;
};

export const ALLOWED_BPMN_ELEMENTS: AllowedBpmnElement[] = [
  {
    key: 'startNode',
    label: 'Start Node',
    bpmnType: 'bpmn:StartEvent',
    paletteClass: 'bpmn-icon-start-event-none',
    group: 'event'
  },
  {
    key: 'endNode',
    label: 'End Node',
    bpmnType: 'bpmn:EndEvent',
    paletteClass: 'bpmn-icon-end-event-none',
    group: 'event'
  },
  {
    key: 'scriptTaskNode',
    label: 'Script Task Node',
    bpmnType: 'bpmn:ScriptTask',
    paletteClass: 'bpmn-icon-script-task',
    group: 'activity'
  },
  {
    key: 'exclusiveGatewayNode',
    label: 'Exclusive Gateway',
    bpmnType: 'bpmn:ExclusiveGateway',
    paletteClass: 'bpmn-icon-gateway-xor',
    group: 'gateway'
  },
  {
    key: 'parallelGatewayNode',
    label: 'Parallel Gateway',
    bpmnType: 'bpmn:ParallelGateway',
    paletteClass: 'bpmn-icon-gateway-parallel',
    group: 'gateway'
  }
];

function RestrictedPaletteProvider(this: any, palette: any, create: any, elementFactory: any, translate: any) {
  palette.registerProvider(this);

  this.getPaletteEntries = () => {
    const entries: Record<string, any> = {};

    ALLOWED_BPMN_ELEMENTS.forEach((element) => {
      const createElement = (event: Event) => {
        const shape = elementFactory.createShape({ type: element.bpmnType });
        create.start(event, shape);
      };

      entries[`create.${element.key}`] = {
        group: element.group,
        className: element.paletteClass,
        title: translate(`Create ${element.label}`),
        action: {
          dragstart: createElement,
          click: createElement
        }
      };
    });

    return entries;
  };
}

RestrictedPaletteProvider.$inject = [
  'palette',
  'create',
  'elementFactory',
  'translate'
];

const restrictedPaletteModule = {
  paletteProvider: [ 'type', RestrictedPaletteProvider ]
};

function RestrictedContextPadProvider(this: any, contextPad: any, connect: any, modeling: any, translate: any) {
  contextPad.registerProvider(this);

  this.getContextPadEntries = (element: any) => {
    if (!element?.businessObject) {
      return {};
    }

    const entries: Record<string, any> = {
      delete: {
        group: 'edit',
        className: 'bpmn-icon-trash',
        title: translate('Delete'),
        action: {
          click: (_event: Event, selectedElement: any) => {
            modeling.removeElements([ selectedElement ]);
          }
        }
      }
    };

    if (element.type !== 'label' && element.businessObject.$type !== 'bpmn:EndEvent') {
      entries.connect = {
        group: 'connect',
        className: 'bpmn-icon-connection-multi',
        title: translate('Connect'),
        action: {
          click: (event: Event, selectedElement: any) => connect.start(event, selectedElement),
          dragstart: (event: Event, selectedElement: any) => connect.start(event, selectedElement)
        }
      };
    }

    return entries;
  };
}

RestrictedContextPadProvider.$inject = [
  'contextPad',
  'connect',
  'modeling',
  'translate'
];

const restrictedContextPadModule = {
  contextPadProvider: [ 'type', RestrictedContextPadProvider ]
};

export class BPMNDesigner {
  private modeler: BpmnModeler;
  private elementRegistry = new ElementRegistry();
  private configManager = new ConfigurationManager();
  private configPanel = new ConfigurationPanel(this.configManager);
  private deploymentService = new DeploymentService(this.configManager);
  private xmlEditorContainer: HTMLElement | null = null;
  private xmlEditor: any = null;
  private xmlEditorReadyPromise: Promise<void> | null = null;
  private zoom = 1;

  constructor(private container: HTMLElement) {
    this.container.classList.add('bpmn-io-canvas');
    this.modeler = new Modeler({
      container,
      keyboard: { bindTo: document },
      additionalModules: [
        restrictedPaletteModule,
        restrictedContextPadModule
      ]
    }) as BpmnModeler;

    this.setupPropertiesPanel();
    this.renderPropertiesPanel(null);

    this.importFromXML(EMPTY_BPMN).catch((error) => {
      console.error('Failed to initialize BPMN.io modeler:', error);
    });
  }

  public initXMLEditor(container: HTMLElement): void {
    this.xmlEditorContainer = container;
    container.innerHTML = '';

    const toolbar = document.createElement('div');
    toolbar.className = 'xml-editor-toolbar';

    const applyButton = document.createElement('button');
    applyButton.className = 'xml-btn';
    applyButton.textContent = 'Apply XML';
    applyButton.addEventListener('click', () => this.applyXMLFromEditor());

    const copyButton = document.createElement('button');
    copyButton.className = 'xml-btn';
    copyButton.textContent = 'Copy';
    copyButton.addEventListener('click', async () => {
      const value = this.xmlEditor?.getValue();
      if (value) {
        await navigator.clipboard.writeText(value);
      }
    });

    toolbar.append(applyButton, copyButton);

    const monacoContainer = document.createElement('div');
    monacoContainer.className = 'bpmn-xml-monaco';
    container.append(toolbar, monacoContainer);

    this.xmlEditorReadyPromise = loadMonaco().then(() => {
      this.xmlEditor = monaco.editor.create(monacoContainer, {
        value: '',
        language: 'xml',
        theme: 'vs',
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        wordWrap: 'on',
        tabSize: 2,
        insertSpaces: true
      });

      let changeTimer: number | null = null;
      this.xmlEditor.onDidChangeModelContent(() => {
        if (changeTimer) {
          window.clearTimeout(changeTimer);
        }
        changeTimer = window.setTimeout(() => this.applyXMLFromEditor(), 800);
      });
    });
  }

  public async showDesigner(): Promise<void> {
    if (this.xmlEditorContainer?.style.display !== 'none') {
      await this.applyXMLFromEditor();
    }

    this.container.style.display = 'block';
    if (this.xmlEditorContainer) {
      this.xmlEditorContainer.style.display = 'none';
    }

    this.getCanvas()?.resized();
  }

  public async showXMLEditor(): Promise<void> {
    const xml = await this.getXML();

    await this.xmlEditorReadyPromise;
    this.xmlEditor?.setValue(xml);

    this.container.style.display = 'none';
    if (this.xmlEditorContainer) {
      this.xmlEditorContainer.style.display = 'block';
    }

    this.xmlEditor?.layout();
  }

  public async toggleView(): Promise<void> {
    if (this.xmlEditorContainer?.style.display === 'block') {
      await this.showDesigner();
    } else {
      await this.showXMLEditor();
    }
  }

  public async exportSVG(): Promise<void> {
    const { svg } = await this.modeler.saveSVG();
    this.download('bpmn-diagram.svg', svg, 'image/svg+xml');
  }

  public async exportBPMN(): Promise<void> {
    this.download('process.bpmn', await this.getXML(), 'text/xml');
  }

  public async importBPMN(file?: File): Promise<void> {
    if (!file) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.bpmn,.xml';
      input.onchange = async () => {
        const selectedFile = input.files?.[0];
        if (selectedFile) {
          await this.importBPMN(selectedFile);
        }
      };
      input.click();
      return;
    }

    try {
      await this.importFromXML(await file.text());
    } catch (error) {
      console.error('Error importing BPMN file:', error);
      alert('Error importing BPMN file. Please check the file format.');
    }
  }

  public async importFromXML(xml: string): Promise<void> {
    await this.modeler.importXML(xml);
    this.getCanvas()?.zoom('fit-viewport', 'auto');
    this.zoom = this.readCurrentZoom();
    this.clearPropertiesPanel();
  }

  public addElement(type: string, x: number, y: number): string {
    const elementFactory = this.modeler.get('elementFactory' as never) as any;
    const modeling = this.modeler.get('modeling' as never) as any;
    const canvas = this.getCanvas();
    const bpmnType = this.mapSimpleTypeToBpmnType(type);
    const shape = elementFactory.createShape({ type: bpmnType });

    modeling.createShape(shape, { x: x + 50, y: y + 40 }, canvas?.getRootElement());
    return shape.id;
  }

  public getElements(): unknown[] {
    const registry = this.modeler.get('elementRegistry' as never) as any;
    return registry.filter((element: any) => Boolean(element.businessObject));
  }

  public getConnections(): unknown[] {
    return this.getElements().filter((element: any) => element.waypoints);
  }

  public getElementRegistry(): ElementRegistry {
    return this.elementRegistry;
  }
  public undo(): void {
    const commandStack = this.modeler.get('commandStack' as never) as any;
    commandStack.undo();
  }

  public redo(): void {
    const commandStack = this.modeler.get('commandStack' as never) as any;
    commandStack.redo();
  }

  public setZoom(zoom: number): void {
    this.zoom = Math.max(0.2, Math.min(4, zoom));
    this.getCanvas()?.zoom(this.zoom);
  }

  public getZoom(): number {
    return this.zoom;
  }

  public async handleDeploy(): Promise<void> {
    try {
      const xml = await this.getXML();
      const result = await this.deploymentService.deploy(xml);

      if (result.success) {
        alert(result.message);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Deployment failed:', error);
      alert('Deployment failed. Check the console for details.');
    }
  }

  public async runEmbedded(): Promise<void> {
    try {
      const deploymentId = this.getActiveDeploymentId();
      const result = await this.deploymentService.runEmbedded(deploymentId);

      if (result.success) {
        alert(`Run embedded started for ${deploymentId}`);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Run embedded failed:', error);
      alert('Run embedded failed. Check the console for details.');
    }
  }

  private getActiveDeploymentId(): string {
    const deploymentInput = document.getElementById('deployment-id-input') as HTMLInputElement | null;
    return deploymentInput?.value || this.configManager.getDeploymentId() || 'default-deployment';
  }

  public showGalaxyPanel(): void {
    let modal = document.querySelector('andromeda-galaxy-modal') as GalaxyModal | null;

    if (!modal) {
      modal = document.createElement('andromeda-galaxy-modal') as GalaxyModal;
      document.body.appendChild(modal);
    }

    modal.setGalaxyUrl(this.configManager.getGalaxyUrl());
    modal.setDeploymentService(this.deploymentService);
    void modal.load();
  }

  private setupPropertiesPanel(): void {
    const eventBus = this.modeler.get('eventBus' as never) as any;

    eventBus.on('selection.changed', (event: any) => {
      const selected = event.newSelection?.[0] || null;
      this.renderPropertiesPanel(selected);
    });

    eventBus.on('commandStack.changed', () => {
      const selection = this.modeler.get('selection' as never) as any;
      this.renderPropertiesPanel(selection.get()?.[0] || null);
    });
  }

  private clearPropertiesPanel(): void {
    this.renderPropertiesPanel(null);
  }

  private renderPropertiesPanel(element: any): void {
    const panel = document.querySelector('.properties-panel') as HTMLElement | null;
    const content = document.getElementById('properties-content');

    if (!panel || !content) {
      return;
    }

    panel.classList.add('visible');

    if (!element?.businessObject || element.type === 'label') {
      this.renderDeploymentConfigPanel(content);
      return;
    }

    const businessObject = element.businessObject;
    const isScriptTask = businessObject.$type === 'bpmn:ScriptTask';
    const isSequenceFlow = businessObject.$type === 'bpmn:SequenceFlow';

    content.innerHTML = `
      <div class="property-group">
        <label>Type</label>
        <input id="bpmn-prop-type" type="text" value="${this.escapeHtml(this.formatBpmnType(businessObject.$type))}" readonly>
      </div>
      <div class="property-group">
        <label>ID</label>
        <input id="bpmn-prop-id" type="text" value="${this.escapeHtml(businessObject.id || '')}" readonly>
      </div>
      <div class="property-group">
        <label>Name</label>
        <input id="bpmn-prop-name" type="text" value="${this.escapeHtml(businessObject.name || '')}">
      </div>
      ${isScriptTask ? `
        <div class="property-group">
          <label>Script Format</label>
          <input id="bpmn-prop-script-format" type="text" value="${this.escapeHtml(businessObject.scriptFormat || '')}" placeholder="javascript">
        </div>
        <div class="property-group">
          <label>Script</label>
          <textarea id="bpmn-prop-script" placeholder="Enter script">${this.escapeHtml(businessObject.script || '')}</textarea>
        </div>
      ` : ''}
      ${isSequenceFlow ? `
        <div class="property-group">
          <label>Condition (script)</label>
          <textarea id="bpmn-prop-condition" placeholder="e.g. this.variables.age > 18">${this.escapeHtml(businessObject.conditionExpression?.body || '')}</textarea>
          <small style="display: block; margin-top: 4px; color: #999; font-size: 11px;">Evaluated as a JS expression at runtime; leave empty for an unconditional flow.</small>
        </div>
      ` : ''}
    `;

    this.bindPropertyInput('bpmn-prop-name', element, 'name');

    if (isScriptTask) {
      this.bindPropertyInput('bpmn-prop-script-format', element, 'scriptFormat');
      this.bindPropertyInput('bpmn-prop-script', element, 'script');
    }

    if (isSequenceFlow) {
      this.bindConditionInput('bpmn-prop-condition', element);
    }
  }

  private bindConditionInput(inputId: string, element: any): void {
    const input = document.getElementById(inputId) as HTMLTextAreaElement | null;
    const modeling = this.modeler.get('modeling' as never) as any;
    const bpmnFactory = this.modeler.get('bpmnFactory' as never) as any;

    input?.addEventListener('change', () => {
      const value = input.value.trim();
      const conditionExpression = value
        ? bpmnFactory.create('bpmn:FormalExpression', { body: value })
        : undefined;

      modeling.updateProperties(element, { conditionExpression });
    });
  }

  private renderDeploymentConfigPanel(content: HTMLElement): void {
    const definitions = this.modeler.getDefinitions() as { id?: string } | undefined;
    const defaultContainerId = definitions?.id || this.configManager.getDeploymentId();

    // keep the stored deployment id in sync with the diagram's definitions id
    // (e.g. after editing raw XML and clicking Apply) so Configuration Settings
    // never shows a stale value when opened later
    if (definitions?.id && definitions.id !== this.configManager.getDeploymentId()) {
      this.configManager.setDeploymentId(definitions.id);
    }

    content.innerHTML = `
      <p style="color: #999; font-size: 12px; margin-bottom: 15px;">Select an element to edit its properties, or set your deployment defaults below.</p>
      <div class="property-group">
        <label>Engine URL</label>
        <input id="bpmn-cfg-engine-url" type="text" placeholder="http://127.0.0.1:5000" value="${this.escapeHtml(this.configManager.getEngineUrl())}">
      </div>
      <div class="property-group">
        <label>Container ID</label>
        <input id="bpmn-cfg-container-id" type="text" placeholder="my-container" value="${this.escapeHtml(defaultContainerId)}">
        <small style="display: block; margin-top: 4px; color: #999; font-size: 11px;">Same as the diagram's definitions id</small>
      </div>
      <div class="property-group">
        <label>Galaxy URL</label>
        <input id="bpmn-cfg-galaxy-url" type="text" placeholder="http://127.0.0.1:5001" value="${this.escapeHtml(this.configManager.getGalaxyUrl())}">
      </div>
      <div class="property-group">
        <label>Process Variables</label>
        ${this.renderProcessVariablesList()}
        <div class="variable-add-row">
          <input id="bpmn-var-name" type="text" placeholder="name">
          <select id="bpmn-var-type">
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="object">object</option>
            <option value="Date">Date</option>
          </select>
          <button id="bpmn-var-add" class="xml-btn" type="button">Add</button>
        </div>
      </div>
    `;

    this.bindConfigInput('bpmn-cfg-engine-url', (value) => this.configManager.setEngineUrl(value));
    this.bindConfigInput('bpmn-cfg-container-id', (value) => {
      this.configManager.setDeploymentId(value);
      this.setDefinitionsId(value);
    });
    this.bindConfigInput('bpmn-cfg-galaxy-url', (value) => this.configManager.setGalaxyUrl(value));
    this.bindProcessVariablesForm();
  }

  // <bpmn:property> declarations on the process element, each paired with an
  // <bpmn:itemDefinition> (see EMPTY_BPMN) - this is what workflow.builder.js's
  // getProcessVariables() reads to generate typed variable accessors on the container.
  private getProcessElement(): any {
    const definitions = this.modeler.getDefinitions() as { rootElements?: any[] } | undefined;
    return (definitions?.rootElements || []).find((element) => element.$type === 'bpmn:Process');
  }

  private renderProcessVariablesList(): string {
    const process = this.getProcessElement();
    const variables: any[] = process?.properties || [];

    if (variables.length === 0) {
      return `<p style="color: #999; font-size: 12px; margin: 4px 0;">No process variables yet.</p>`;
    }

    return `
      <ul class="variable-list">
        ${variables.map((variable) => `
          <li class="variable-list-item">
            <span class="variable-name">${this.escapeHtml(variable.name || '')}</span>
            <span class="variable-type">${this.escapeHtml(variable.itemSubjectRef?.structureRef || 'string')}</span>
            <button class="xml-btn variable-remove" type="button" data-variable-name="${this.escapeHtml(variable.name || '')}">Remove</button>
          </li>
        `).join('')}
      </ul>
    `;
  }

  private bindProcessVariablesForm(): void {
    const addButton = document.getElementById('bpmn-var-add');
    const nameInput = document.getElementById('bpmn-var-name') as HTMLInputElement | null;
    const typeSelect = document.getElementById('bpmn-var-type') as HTMLSelectElement | null;

    addButton?.addEventListener('click', () => {
      const name = nameInput?.value.trim();
      const type = typeSelect?.value || 'string';
      if (!name) {
        return;
      }
      this.addProcessVariable(name, type);
    });

    document.querySelectorAll('.variable-remove').forEach((button) => {
      button.addEventListener('click', () => {
        const name = (button as HTMLElement).dataset.variableName;
        if (name) {
          this.removeProcessVariable(name);
        }
      });
    });
  }

  private addProcessVariable(name: string, type: string): void {
    const definitions = this.modeler.getDefinitions() as { rootElements?: any[] } | undefined;
    const process = this.getProcessElement();

    if (!definitions || !process) {
      return;
    }
    if ((process.properties || []).some((variable: any) => variable.name === name)) {
      alert(`A variable named "${name}" already exists`);
      return;
    }

    const bpmnFactory = this.modeler.get('bpmnFactory' as never) as any;

    const itemDefinition = bpmnFactory.create('bpmn:ItemDefinition', { structureRef: type });
    itemDefinition.$parent = definitions;
    definitions.rootElements = [...(definitions.rootElements || []), itemDefinition];

    const property = bpmnFactory.create('bpmn:Property', { name, itemSubjectRef: itemDefinition });
    property.$parent = process;
    process.properties = [...(process.properties || []), property];

    this.renderPropertiesPanel(null);
  }

  private removeProcessVariable(name: string): void {
    const definitions = this.modeler.getDefinitions() as { rootElements?: any[] } | undefined;
    const process = this.getProcessElement();

    if (!process) {
      return;
    }

    const property = (process.properties || []).find((variable: any) => variable.name === name);
    if (!property) {
      return;
    }

    process.properties = (process.properties || []).filter((variable: any) => variable.name !== name);
    if (definitions && property.itemSubjectRef) {
      definitions.rootElements = (definitions.rootElements || []).filter(
        (element: any) => element !== property.itemSubjectRef
      );
    }

    this.renderPropertiesPanel(null);
  }

  private setDefinitionsId(value: string): void {
    if (!value) {
      return;
    }
    const definitions = this.modeler.getDefinitions() as { id?: string } | undefined;
    if (definitions) {
      definitions.id = value;
    }
  }

  private bindConfigInput(inputId: string, apply: (value: string) => void): void {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    input?.addEventListener('change', () => apply(input.value));
  }

  private bindPropertyInput(inputId: string, element: any, propertyName: string): void {
    const input = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement | null;
    const modeling = this.modeler.get('modeling' as never) as any;

    input?.addEventListener('change', () => {
      modeling.updateProperties(element, {
        [propertyName]: input.value
      });
    });
  }

  private formatBpmnType(type: string): string {
    return type.replace(/^bpmn:/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public setupPaletteDragDrop(): void {
    // BPMN.io provides its own palette and drag/drop behavior.
  }

  private async getXML(): Promise<string> {
    const { xml } = await this.modeler.saveXML({ format: true, preamble: true });
    return xml || EMPTY_BPMN;
  }

  private async applyXMLFromEditor(): Promise<void> {
    const xml = this.xmlEditor?.getValue()?.trim();

    if (!xml) {
      return;
    }

    try {
      await this.importFromXML(xml);
    } catch (error) {
      console.error('Invalid BPMN XML:', error);
    }
  }

  private getCanvas(): any {
    return this.modeler.get('canvas' as never) as any;
  }

  private readCurrentZoom(): number {
    const viewbox = this.getCanvas()?.viewbox();
    return typeof viewbox?.scale === 'number' ? viewbox.scale : this.zoom;
  }

  private mapSimpleTypeToBpmnType(type: string): string {
    const mapping: Record<string, string> = {
      startNode: 'bpmn:StartEvent',
      startEvent: 'bpmn:StartEvent',
      endNode: 'bpmn:EndEvent',
      endEvent: 'bpmn:EndEvent',
      task: 'bpmn:Task',
      userTask: 'bpmn:UserTask',
      serviceTask: 'bpmn:ServiceTask',
      scriptTaskNode: 'bpmn:ScriptTask',
      scriptTask: 'bpmn:ScriptTask',
      exclusiveGateway: 'bpmn:ExclusiveGateway',
      parallelGateway: 'bpmn:ParallelGateway'
    };

    return mapping[type] || 'bpmn:Task';
  }

  private download(filename: string, content: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}


