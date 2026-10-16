import Modeler from 'bpmn-js/lib/Modeler';
import { ElementRegistry } from './ElementDefinition';
import { ConfigurationManager } from './ConfigurationManager';
import { ConfigurationPanel } from './ConfigurationPanel';
import { DeploymentService } from './DeploymentService';
import { loadMonaco } from './MonacoLoader';
import { showToast } from './Toast';
import { FormBuilderModal } from './FormBuilderModal';
import { formComponents, formFieldKeys, generateForm, type FormVariable, type IFormDefinition as FormDefinition } from '../iform';
// the engine's BPMN extension (human task form + editable variables) - one
// descriptor shared by the designer and the engine's parser
import andromedaModdleSource from '../../../engine/src/modules/engine/builder/andromeda.moddle.json?raw';

const ANDROMEDA_MODDLE = JSON.parse(andromedaModdleSource);

/** May complete any human task - built in, never declared in the diagram. */
export const ADMIN_ROLE = 'process-admin';

declare const monaco: any;

const EMPTY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="wee" version="1.0.0" targetNamespace="http://bpmn.io/schema/bpmn">
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
  // Passed straight through to bpmn-js's own ElementFactory.createBpmnElement,
  // which already knows how to attach a fresh event definition of this type to
  // the created shape's businessObject.eventDefinitions - see
  // node_modules/bpmn-js/lib/features/modeling/ElementFactory.js.
  eventDefinitionType?: string;
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
    key: 'timerStartNode',
    label: 'Timer Start Event',
    bpmnType: 'bpmn:StartEvent',
    paletteClass: 'bpmn-icon-start-event-timer',
    group: 'event',
    eventDefinitionType: 'bpmn:TimerEventDefinition'
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
    key: 'humanTaskNode',
    label: 'Human Task',
    bpmnType: 'bpmn:UserTask',
    paletteClass: 'bpmn-icon-user-task',
    group: 'activity'
  },
  {
    key: 'catchEventNode',
    label: 'Catch Event',
    bpmnType: 'bpmn:IntermediateCatchEvent',
    paletteClass: 'bpmn-icon-intermediate-event-none',
    group: 'event'
  },
  {
    key: 'catchSignalEventNode',
    label: 'Catch Signal Event',
    bpmnType: 'bpmn:IntermediateCatchEvent',
    paletteClass: 'bpmn-icon-intermediate-event-catch-signal',
    group: 'event',
    eventDefinitionType: 'bpmn:SignalEventDefinition'
  },
  {
    key: 'timerCatchEventNode',
    label: 'Timer Catch Event',
    bpmnType: 'bpmn:IntermediateCatchEvent',
    paletteClass: 'bpmn-icon-intermediate-event-catch-timer',
    group: 'event',
    eventDefinitionType: 'bpmn:TimerEventDefinition'
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
        const shape = elementFactory.createShape({
          type: element.bpmnType,
          eventDefinitionType: element.eventDefinitionType
        });
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

// Elements offered as "append" shortcuts on the context pad - anything creatable from the
// palette except Start Event, which never makes sense as the target of an append (it must
// have zero incoming flows).
const APPENDABLE_BPMN_ELEMENTS = ALLOWED_BPMN_ELEMENTS.filter(
  (element) => element.bpmnType !== 'bpmn:StartEvent'
);

function RestrictedContextPadProvider(
  this: any,
  contextPad: any,
  connect: any,
  modeling: any,
  translate: any,
  elementFactory: any,
  create: any,
  autoPlace: any
) {
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

    const canConnectOnward = element.type !== 'label' && element.businessObject.$type !== 'bpmn:EndEvent';

    if (canConnectOnward) {
      entries.connect = {
        group: 'connect',
        className: 'bpmn-icon-connection-multi',
        title: translate('Connect'),
        action: {
          click: (event: Event, selectedElement: any) => connect.start(event, selectedElement),
          dragstart: (event: Event, selectedElement: any) => connect.start(event, selectedElement)
        }
      };

      APPENDABLE_BPMN_ELEMENTS.forEach((appendable) => {
        entries[`append.${appendable.key}`] = {
          group: 'model',
          className: appendable.paletteClass,
          title: translate(`Append ${appendable.label}`),
          action: {
            click: (_event: Event, selectedElement: any) => {
              const shape = elementFactory.createShape({
                type: appendable.bpmnType,
                eventDefinitionType: appendable.eventDefinitionType
              });
              autoPlace.append(selectedElement, shape);
            },
            dragstart: (event: Event, selectedElement: any) => {
              const shape = elementFactory.createShape({
                type: appendable.bpmnType,
                eventDefinitionType: appendable.eventDefinitionType
              });
              create.start(event, shape, { source: selectedElement });
            }
          }
        };
      });
    }

    return entries;
  };
}

RestrictedContextPadProvider.$inject = [
  'contextPad',
  'connect',
  'modeling',
  'translate',
  'elementFactory',
  'create',
  'autoPlace'
];

const restrictedContextPadModule = {
  contextPadProvider: [ 'type', RestrictedContextPadProvider ]
};

export class BPMNDesigner {
  private modeler: BpmnModeler;
  private elementRegistry = new ElementRegistry();
  private configManager = new ConfigurationManager();
  private configPanel = new ConfigurationPanel(this.configManager);
  private formBuilder = new FormBuilderModal();
  /** Monaco editor of the selected script task's script (see mountScriptEditor) */
  private scriptEditor: { editor: any; save: () => void } | null = null;
  private scriptEditorGeneration = 0;
  private deploymentService = new DeploymentService(this.configManager);
  private xmlEditorContainer: HTMLElement | null = null;
  private xmlEditor: any = null;
  private xmlEditorReadyPromise: Promise<void> | null = null;
  // the XML editor sits in its own dock panel, possibly side by side with the
  // diagram: while it's visible, diagram edits are mirrored into it
  private xmlEditorVisible = false;
  // set while the editor content is replaced programmatically, so that
  // change doesn't bounce back as a re-import of the diagram
  private settingXmlValue = false;
  // a diagram was imported while the canvas had no size - fit once it's shown
  private pendingFit = false;
  private zoom = 1;

  constructor(private container: HTMLElement, initialXML: string = EMPTY_BPMN) {
    this.container.classList.add('bpmn-io-canvas');
    this.modeler = new Modeler({
      container,
      keyboard: { bindTo: document },
      moddleExtensions: { andromeda: ANDROMEDA_MODDLE },
      additionalModules: [
        restrictedPaletteModule,
        restrictedContextPadModule
      ]
    }) as BpmnModeler;

    this.setupPropertiesPanel();
    this.renderPropertiesPanel(null);

    this.importFromXML(initialXML).catch((error) => {
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
        if (this.settingXmlValue) {
          return;
        }
        if (changeTimer) {
          window.clearTimeout(changeTimer);
        }
        changeTimer = window.setTimeout(() => this.applyXMLFromEditor(), 800);
      });
    });

    // keep a visible XML editor in sync with diagram edits (unless the user
    // is typing in it - their edits flow the other way, see above)
    const eventBus = this.modeler.get('eventBus' as never) as any;
    eventBus.on('commandStack.changed', () => {
      if (this.xmlEditorVisible && !this.xmlEditor?.hasTextFocus()) {
        void this.refreshXMLEditor();
      }
    });
  }

  /** The diagram's dock panel was shown or resized. */
  public showDesigner(): void {
    this.getCanvas()?.resized();
    if (this.pendingFit) {
      this.fitViewport();
    }
  }

  /** The XML editor's dock panel was shown or hidden. */
  public async setXMLEditorVisible(visible: boolean): Promise<void> {
    this.xmlEditorVisible = visible;
    if (visible) {
      await this.refreshXMLEditor();
    }
  }

  /** Re-lays out the XML editor after its dock panel was resized. */
  public layoutXMLEditor(): void {
    this.xmlEditor?.layout();
  }

  private async refreshXMLEditor(): Promise<void> {
    let xml: string;
    try {
      xml = await this.getXML();
    } catch {
      return; // no diagram imported yet - nothing to show
    }

    await this.xmlEditorReadyPromise;
    if (this.xmlEditor && this.xmlEditor.getValue() !== xml) {
      this.settingXmlValue = true;
      try {
        this.xmlEditor.setValue(xml);
      } finally {
        this.settingXmlValue = false;
      }
    }

    this.xmlEditor?.layout();
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
      showToast('Error importing BPMN file. Please check the file format.', 'error');
    }
  }

  public async importFromXML(xml: string): Promise<void> {
    await this.modeler.importXML(xml);
    this.pendingFit = true;
    this.fitViewport();
    this.clearPropertiesPanel();
    // e.g. an example loaded, or the first diagram finishing its import after
    // a restored layout already showed the XML tab
    if (this.xmlEditorVisible && !this.xmlEditor?.hasTextFocus()) {
      void this.refreshXMLEditor();
    }
  }

  /**
   * Fits the diagram to the canvas - deferred (see showDesigner) while the
   * canvas has no size, e.g. its dock tab is in the background: bpmn-js would
   * otherwise compute a non-finite zoom from a 0x0 viewport.
   */
  private fitViewport(): void {
    if (this.container.clientWidth === 0 || this.container.clientHeight === 0) {
      return;
    }
    this.pendingFit = false;
    this.getCanvas()?.zoom('fit-viewport', 'auto');
    this.zoom = this.readCurrentZoom();
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

  private deploying = false;

  /**
   * Deploy: compiles the diagram into a container (POST /api/compile), then
   * starts it embedded (POST /api/run-embedded) - the second step only when
   * the first succeeded, with the versioned id the compile resolved.
   */
  public async compileAndDeploy(): Promise<void> {
    if (this.deploying) return; // a second click while one runs
    this.deploying = true;
    try {
      showToast('Compiling…', 'info');
      const compiled = await this.deploymentService.deploy(await this.getXML());
      if (!compiled.success) {
        showToast(compiled.message, 'error');
        return;
      }
      const deploymentId = this.getActiveDeploymentId();
      showToast(`Compiled - starting ${deploymentId}…`, 'info');
      const started = await this.deploymentService.runEmbedded(deploymentId);
      showToast(started.success ? `Deployed ${deploymentId}` : started.message, started.success ? 'success' : 'error');
    } catch (error) {
      console.error('Deployment failed:', error);
      showToast('Deployment failed. Check the console for details.', 'error');
    } finally {
      this.deploying = false;
    }
  }

  private getActiveDeploymentId(): string {
    // prefer the resolved (versioned) folder id returned by the last successful
    // compile - the engine names the deployment folder <id>_<version>, so Run/Stop
    // Embedded need that exact id, not the raw "Container ID" the user typed
    const deploymentInput = document.getElementById('deployment-id-input') as HTMLInputElement | null;
    return this.configManager.getResolvedDeploymentId() || deploymentInput?.value || this.configManager.getDeploymentId() || 'default-deployment';
  }

  /** Galaxy base URL from Configuration Settings, read fresh on every use. */
  public getGalaxyUrl(): string {
    return this.configManager.getGalaxyUrl();
  }

  /** Authorization header for container calls (OIDC access token), read fresh on every use. */
  public getAuthHeaders(): Record<string, string> {
    return this.configManager.getAuthHeaders();
  }

  public getDeploymentService(): DeploymentService {
    return this.deploymentService;
  }

  public showConfiguration(): void {
    this.configPanel.show();
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
    this.disposeScriptEditor();

    if (!element?.businessObject || element.type === 'label') {
      this.renderDeploymentConfigPanel(content);
      return;
    }

    const businessObject = element.businessObject;
    const isScriptTask = businessObject.$type === 'bpmn:ScriptTask';
    const isUserTask = businessObject.$type === 'bpmn:UserTask';
    const isSequenceFlow = businessObject.$type === 'bpmn:SequenceFlow';
    const eventDefinition = (businessObject.eventDefinitions || [])[0];
    const isTimerStartEvent = businessObject.$type === 'bpmn:StartEvent'
      && eventDefinition?.$type === 'bpmn:TimerEventDefinition';
    const isSignalCatchEvent = businessObject.$type === 'bpmn:IntermediateCatchEvent'
      && eventDefinition?.$type === 'bpmn:SignalEventDefinition';
    const isTimerCatchEvent = businessObject.$type === 'bpmn:IntermediateCatchEvent'
      && eventDefinition?.$type === 'bpmn:TimerEventDefinition';
    const isTimerCatchDateMode = isTimerCatchEvent && Boolean(eventDefinition?.timeDate?.body);

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
      ${isUserTask ? this.renderUserTaskSections(businessObject) : ''}
      ${isSequenceFlow ? `
        <div class="property-group">
          <label>Condition (script)</label>
          <textarea id="bpmn-prop-condition" placeholder="e.g. this.variables.age > 18">${this.escapeHtml(businessObject.conditionExpression?.body || '')}</textarea>
          <small style="display: block; margin-top: 4px; color: #999; font-size: 11px;">Evaluated as a JS expression at runtime; leave empty for an unconditional flow.</small>
        </div>
      ` : ''}
      ${isTimerStartEvent ? `
        <div class="property-group">
          <label>Cron Expression</label>
          <input id="bpmn-prop-time-cycle" type="text" value="${this.escapeHtml(eventDefinition.timeCycle?.body || '')}" placeholder="0 9 * * *">
          <small style="display: block; margin-top: 4px; color: #999; font-size: 11px;">Standard cron expression; a process instance is created automatically on each fire.</small>
        </div>
      ` : ''}
      ${isSignalCatchEvent ? `
        <div class="property-group">
          <label>Signal Name</label>
          <input id="bpmn-prop-signal-name" type="text" value="${this.escapeHtml(eventDefinition.signalRef?.name || '')}" placeholder="approval">
          <small style="display: block; margin-top: 4px; color: #999; font-size: 11px;">Resumed via POST /signal naming this node once reached; leave empty to wait for a generic signal.</small>
        </div>
      ` : ''}
      ${isTimerCatchEvent ? `
        <div class="property-group">
          <label>Timer Mode</label>
          <select id="bpmn-prop-timer-mode">
            <option value="duration" ${!isTimerCatchDateMode ? 'selected' : ''}>Duration (relative to arrival)</option>
            <option value="date" ${isTimerCatchDateMode ? 'selected' : ''}>Date (absolute instant)</option>
          </select>
        </div>
        <div class="property-group">
          <label>${isTimerCatchDateMode ? 'Date/Time (ISO 8601)' : 'Duration (ISO 8601)'}</label>
          <input id="bpmn-prop-timer-value" type="text" value="${this.escapeHtml((isTimerCatchDateMode ? eventDefinition.timeDate?.body : eventDefinition.timeDuration?.body) || '')}" placeholder="${isTimerCatchDateMode ? '2026-08-01T09:00:00Z' : 'PT5M'}">
        </div>
      ` : ''}
    `;

    this.bindPropertyInput('bpmn-prop-name', element, 'name');

    if (isScriptTask) {
      this.bindPropertyInput('bpmn-prop-script-format', element, 'scriptFormat');
      this.bindPropertyInput('bpmn-prop-script', element, 'script');
      this.mountScriptEditor(element);
    }

    if (isUserTask) {
      this.bindUserTaskInputs(element);
    }

    if (isSequenceFlow) {
      this.bindConditionInput('bpmn-prop-condition', element);
    }

    if (isTimerStartEvent) {
      this.bindEventDefinitionExpressionInput('bpmn-prop-time-cycle', element, eventDefinition, 'timeCycle');
    }

    if (isSignalCatchEvent) {
      this.bindSignalNameInput('bpmn-prop-signal-name', element, eventDefinition);
    }

    if (isTimerCatchEvent) {
      this.bindTimerCatchInputs(element, eventDefinition, isTimerCatchDateMode);
    }
  }

  // ---- human tasks: roles, editable variables, form ------------------------
  // Stored as <bpmn:potentialOwner> references to declared roles, and
  // <andromeda:editableVariable> / <andromeda:form> extension elements - read
  // by the engine's human-task.node.processor.js.

  private getUserTaskRoleIds(businessObject: any): Set<string> {
    return new Set(
      (businessObject.resources || [])
        .filter((owner: any) => owner.$type === 'bpmn:PotentialOwner' && owner.resourceRef)
        .map((owner: any) => owner.resourceRef.id)
    );
  }

  private getEditableVariables(businessObject: any): string[] {
    return (businessObject.extensionElements?.values || [])
      .filter((value: any) => value.$type === 'andromeda:EditableVariable' && value.name)
      .map((value: any) => value.name);
  }

  private getUserTaskForm(businessObject: any): FormDefinition | null {
    const formElement = (businessObject.extensionElements?.values || []).find((value: any) => value.$type === 'andromeda:Form');
    if (!formElement?.body) return null;
    try {
      return JSON.parse(formElement.body);
    } catch {
      return null;
    }
  }

  private renderUserTaskSections(businessObject: any): string {
    const roles = this.getRoles();
    const assigned = this.getUserTaskRoleIds(businessObject);
    const variables = this.getFormVariables().map((variable) => variable.name);
    const editable = new Set(this.getEditableVariables(businessObject));
    const form = this.getUserTaskForm(businessObject);
    const fields = formFieldKeys(form);

    const roleRows = roles.length > 0
      ? roles.map((role) => `
          <label class="check-row">
            <input type="checkbox" class="task-role" data-role-id="${this.escapeHtml(role.id)}" ${assigned.has(role.id) ? 'checked' : ''}>
            ${this.escapeHtml(role.name || role.id)}
          </label>`).join('')
      : `<p class="property-hint">No roles declared yet - add them in the process panel (click the canvas background).</p>`;

    const fieldChip = (key: string) => {
      const bound = variables.includes(key);
      const note = !bound ? 'not a variable' : editable.has(key) ? 'editable' : 'read-only';
      return `<code class="${bound && editable.has(key) ? 'bound' : ''}" title="${note}">${this.escapeHtml(key)}${bound && !editable.has(key) ? ' 🔒' : ''}</code>`;
    };
    const formSummary = form
      ? `<p class="property-hint">${fields.length} field(s): ${fields.map(fieldChip).join(' ') || '<em>none</em>'}</p>
         <p class="property-hint">Highlighted fields set the process variable of the same name when the task is accepted; 🔒 fields only show it.</p>`
      : `<p class="property-hint">No form yet - generate one from the process variables, or design it by hand.</p>`;

    return `
      <div class="property-group">
        <label>Roles allowed to complete it</label>
        <label class="check-row check-row-fixed"><input type="checkbox" checked disabled> ${ADMIN_ROLE} <span class="check-note">always</span></label>
        ${roleRows}
        <p class="property-hint">None checked: any authenticated user (when OIDC is on).</p>
      </div>
      <div class="property-group">
        <label>Form</label>
        ${formSummary}
        <div class="variable-add-row">
          <button id="task-form-generate" class="xml-btn" type="button" ${variables.length === 0 ? 'disabled title="Declare process variables first"' : ''}>Generate form</button>
          ${form ? '<button id="task-form-preview" class="xml-btn" type="button">Preview</button>' : ''}
          <button id="task-form-design" class="xml-btn" type="button">${form ? 'Edit form' : 'Design form'}</button>
          ${form ? '<button id="task-form-remove" class="xml-btn" type="button">Remove form</button>' : ''}
        </div>
      </div>
    `;
  }

  private bindUserTaskInputs(element: any): void {
    const businessObject = element.businessObject;

    document.querySelectorAll<HTMLInputElement>('.task-role').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const ids = Array.from(document.querySelectorAll<HTMLInputElement>('.task-role'))
          .filter((box) => box.checked)
          .map((box) => box.dataset.roleId as string);
        this.setUserTaskRoles(element, ids);
      });
    });

    const title = businessObject.name || businessObject.id;

    document.getElementById('task-form-generate')?.addEventListener('click', async () => {
      const variables = this.getFormVariables();
      // preselect what the current form already shows
      const current: FormVariable[] = [];
      for (const component of formComponents(this.getUserTaskForm(businessObject)).values()) {
        const variable = variables.find((candidate) => candidate.name === component.key);
        if (variable) current.push({ ...variable, readOnly: !!component.disabled, uiHint: component.ui_hint });
      }
      const picked = await this.formBuilder.pickVariables(title, variables, current);
      if (!picked) return;
      this.saveUserTaskForm(element, picked.length > 0 ? generateForm(picked) : null);
    });

    document.getElementById('task-form-preview')?.addEventListener('click', () => {
      const form = this.getUserTaskForm(businessObject);
      if (form) this.formBuilder.preview(title, form);
    });

    document.getElementById('task-form-design')?.addEventListener('click', async () => {
      const variables = this.getFormVariables();
      const form = await this.formBuilder.edit(title, this.getUserTaskForm(businessObject), variables);
      if (form) this.saveUserTaskForm(element, form);
    });

    document.getElementById('task-form-remove')?.addEventListener('click', () => {
      this.saveUserTaskForm(element, null);
    });
  }

  /** Process variables with their declared type, for form generation. */
  private getFormVariables(): FormVariable[] {
    return (this.getProcessElement()?.properties || [])
      .filter((variable: any) => variable.name)
      .map((variable: any) => ({ name: variable.name, type: variable.itemSubjectRef?.structureRef || 'string' }));
  }

  /**
   * Stores the task's form; the variables it may change follow from it: the
   * enabled fields named like a process variable (disabled ones only show a
   * value). No form: no editable list.
   */
  private saveUserTaskForm(element: any, form: FormDefinition | null): void {
    const variables = this.getFormVariables().map((variable) => variable.name);
    const editable = formFieldKeys(form, { editableOnly: true }).filter((key) => variables.includes(key));
    this.setUserTaskExtensions(element, { form, editable });
    if (form) showToast(editable.length > 0 ? `Form saved - the task may change: ${editable.join(', ')}` : 'Form saved - the task changes no variables', 'success');
    this.renderPropertiesPanel(element);
  }

  private setUserTaskRoles(element: any, roleIds: string[]): void {
    const modeling = this.modeler.get('modeling' as never) as any;
    const bpmnFactory = this.modeler.get('bpmnFactory' as never) as any;
    const roles = this.getRoles();
    const others = (element.businessObject.resources || []).filter((owner: any) => owner.$type !== 'bpmn:PotentialOwner');
    const owners = roleIds
      .map((id) => roles.find((role) => role.id === id))
      .filter(Boolean)
      .map((role) => bpmnFactory.create('bpmn:PotentialOwner', { resourceRef: role }));
    owners.forEach((owner: any) => { owner.$parent = element.businessObject; });
    modeling.updateProperties(element, { resources: [...others, ...owners] });
  }

  /** Replaces the task's andromeda:* extension elements, keeping any others. */
  private setUserTaskExtensions(element: any, changes: { editable?: string[]; form?: FormDefinition | null }): void {
    const modeling = this.modeler.get('modeling' as never) as any;
    const bpmnFactory = this.modeler.get('bpmnFactory' as never) as any;
    const businessObject = element.businessObject;
    const current: any[] = businessObject.extensionElements?.values || [];

    const editable = changes.editable ?? this.getEditableVariables(businessObject);
    const form = changes.form !== undefined ? changes.form : this.getUserTaskForm(businessObject);

    const values = [
      ...current.filter((value) => value.$type !== 'andromeda:EditableVariable' && value.$type !== 'andromeda:Form'),
      ...editable.map((name) => bpmnFactory.create('andromeda:EditableVariable', { name })),
      ...(form ? [bpmnFactory.create('andromeda:Form', { body: JSON.stringify(form, null, 2) })] : []),
    ];
    const extensionElements = bpmnFactory.create('bpmn:ExtensionElements', { values });
    values.forEach((value) => { value.$parent = extensionElements; });
    extensionElements.$parent = businessObject;
    modeling.updateProperties(element, { extensionElements: values.length > 0 ? extensionElements : undefined });
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

  // Shared by the timer start event's timeCycle and, indirectly via
  // bindTimerCatchInputs, the timer catch event's timeDuration/timeDate -
  // all three are bpmn:Expression-typed children of an eventDefinition, not
  // of the shape's own businessObject, so they go through
  // modeling.updateModdleProperties rather than updateProperties.
  private bindEventDefinitionExpressionInput(
    inputId: string,
    element: any,
    eventDefinition: any,
    propertyName: string
  ): void {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    const modeling = this.modeler.get('modeling' as never) as any;
    const bpmnFactory = this.modeler.get('bpmnFactory' as never) as any;

    input?.addEventListener('change', () => {
      const value = input.value.trim();
      const expression = value ? bpmnFactory.create('bpmn:FormalExpression', { body: value }) : undefined;

      modeling.updateModdleProperties(element, eventDefinition, { [propertyName]: expression });
    });
  }

  private bindSignalNameInput(inputId: string, element: any, eventDefinition: any): void {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    const modeling = this.modeler.get('modeling' as never) as any;

    input?.addEventListener('change', () => {
      const name = input.value.trim();
      const signalRef = name ? this.findOrCreateSignal(name) : undefined;

      modeling.updateModdleProperties(element, eventDefinition, { signalRef });
    });
  }

  // Signals are top-level bpmn:Signal root elements referenced by name (not
  // embedded in the catch event itself), matching how catch-event.processor.js
  // reads eventDefinitions[0].signalRef.name - reusing an existing bpmn:Signal
  // of the same name lets multiple catch events wait on the same broadcast
  // signal rather than each minting their own.
  private findOrCreateSignal(name: string): any {
    const definitions = this.modeler.getDefinitions() as { rootElements?: any[] } | undefined;
    const bpmnFactory = this.modeler.get('bpmnFactory' as never) as any;

    const existing = (definitions?.rootElements || []).find(
      (rootElement: any) => rootElement.$type === 'bpmn:Signal' && rootElement.name === name
    );
    if (existing) {
      return existing;
    }

    const signal = bpmnFactory.create('bpmn:Signal', { name });
    if (definitions) {
      signal.$parent = definitions;
      definitions.rootElements = [...(definitions.rootElements || []), signal];
    }

    return signal;
  }

  // timeDuration and timeDate are mutually exclusive on a timer catch event
  // (see catch-event.processor.js), so switching mode clears both before the
  // user enters a fresh value, and the value input always writes to whichever
  // one the mode select currently points at.
  private bindTimerCatchInputs(element: any, eventDefinition: any, isDateMode: boolean): void {
    const modeSelect = document.getElementById('bpmn-prop-timer-mode') as HTMLSelectElement | null;
    const valueInput = document.getElementById('bpmn-prop-timer-value') as HTMLInputElement | null;
    const modeling = this.modeler.get('modeling' as never) as any;
    const bpmnFactory = this.modeler.get('bpmnFactory' as never) as any;

    modeSelect?.addEventListener('change', () => {
      modeling.updateModdleProperties(element, eventDefinition, {
        timeDuration: undefined,
        timeDate: undefined
      });
      this.renderPropertiesPanel(element);
    });

    valueInput?.addEventListener('change', () => {
      const value = valueInput.value.trim();
      const expression = value ? bpmnFactory.create('bpmn:FormalExpression', { body: value }) : undefined;
      const propertyName = isDateMode ? 'timeDate' : 'timeDuration';

      modeling.updateModdleProperties(element, eventDefinition, { [propertyName]: expression });
    });
  }

  private renderDeploymentConfigPanel(content: HTMLElement): void {
    const definitions = this.modeler.getDefinitions() as { id?: string; $attrs?: Record<string, string> } | undefined;
    const defaultContainerId = definitions?.id || this.configManager.getDeploymentId();
    const currentVersion = definitions?.$attrs?.version || this.configManager.getVersion();

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
        <label>Version</label>
        <input id="bpmn-cfg-version" type="text" placeholder="1.0.0" value="${this.escapeHtml(currentVersion)}">
        <small style="display: block; margin-top: 4px; color: #999; font-size: 11px;">Same as the diagram's definitions version; folded into the deployment folder name</small>
      </div>
      <div class="property-group">
        <label>Galaxy URL</label>
        <input id="bpmn-cfg-galaxy-url" type="text" placeholder="http://127.0.0.1:5001" value="${this.escapeHtml(this.configManager.getGalaxyUrl())}">
      </div>
      <div class="property-group">
        <label>Access token (OIDC)</label>
        <input id="bpmn-cfg-access-token" type="password" autocomplete="off" placeholder="only when containers run with OIDC_ENABLED" value="${this.escapeHtml(this.configManager.getAccessToken())}">
        <small style="display: block; margin-top: 4px; color: #999; font-size: 11px;">Sent as a bearer token to containers' human tasks; kept for this browser tab only. Without OIDC the designer acts as ${ADMIN_ROLE}.</small>
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
            <option value="file">file</option>
          </select>
          <button id="bpmn-var-add" class="xml-btn" type="button">Add</button>
        </div>
      </div>
      <div class="property-group">
        <label>Roles</label>
        ${this.renderRolesList()}
        <div class="variable-add-row">
          <input id="bpmn-role-name" type="text" placeholder="role, e.g. approver">
          <button id="bpmn-role-add" class="xml-btn" type="button">Add</button>
        </div>
        <small style="display: block; margin-top: 4px; color: #999; font-size: 11px;">Read from the OIDC token's roles. Assign them to human tasks; ${ADMIN_ROLE} may complete any task.</small>
      </div>
    `;

    this.bindConfigInput('bpmn-cfg-engine-url', (value) => this.configManager.setEngineUrl(value));
    this.bindConfigInput('bpmn-cfg-container-id', (value) => {
      this.configManager.setDeploymentId(value);
      this.setDefinitionsId(value);
    });
    this.bindConfigInput('bpmn-cfg-version', (value) => {
      this.configManager.setVersion(value);
      this.setDefinitionsVersion(value);
    });
    this.bindConfigInput('bpmn-cfg-galaxy-url', (value) => this.configManager.setGalaxyUrl(value));
    this.bindConfigInput('bpmn-cfg-access-token', (value) => this.configManager.setAccessToken(value));
    this.bindProcessVariablesForm();
    this.bindRolesForm();
  }

  // Roles are <bpmn:resource name="..."> root elements - declared like
  // variables, referenced by human tasks' <bpmn:potentialOwner> (see
  // human-task.node.processor.js). process-admin is built in, never declared.
  private getRoles(): any[] {
    const definitions = this.modeler.getDefinitions() as { rootElements?: any[] } | undefined;
    return (definitions?.rootElements || []).filter((element: any) => element.$type === 'bpmn:Resource');
  }

  private renderRolesList(): string {
    const roles = this.getRoles();
    return `
      <ul class="variable-list">
        <li class="variable-list-item">
          <span class="variable-name">${ADMIN_ROLE}</span>
          <span class="variable-type">built in</span>
        </li>
        ${roles.map((role) => `
          <li class="variable-list-item">
            <span class="variable-name">${this.escapeHtml(role.name || role.id)}</span>
            <span class="variable-type">${this.countTasksWithRole(role)} task(s)</span>
            <button class="xml-btn role-remove" type="button" data-role-id="${this.escapeHtml(role.id)}">Remove</button>
          </li>
        `).join('')}
      </ul>
    `;
  }

  private countTasksWithRole(role: any): number {
    const process = this.getProcessElement();
    return (process?.flowElements || []).filter((element: any) =>
      element.$type === 'bpmn:UserTask' && (element.resources || []).some((owner: any) => owner.resourceRef === role)
    ).length;
  }

  private bindRolesForm(): void {
    const input = document.getElementById('bpmn-role-name') as HTMLInputElement | null;
    const add = () => {
      const name = input?.value.trim();
      if (name) this.addRole(name);
    };
    document.getElementById('bpmn-role-add')?.addEventListener('click', add);
    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') add();
    });
    document.querySelectorAll('.role-remove').forEach((button) => {
      button.addEventListener('click', () => {
        const id = (button as HTMLElement).dataset.roleId;
        if (id) this.removeRole(id);
      });
    });
  }

  private addRole(name: string): void {
    const definitions = this.modeler.getDefinitions() as { rootElements?: any[] } | undefined;
    if (!definitions) return;
    if (name === ADMIN_ROLE) {
      showToast(`${ADMIN_ROLE} is built in - no need to declare it`, 'info');
      return;
    }
    if (!/^[\w.:-]+$/.test(name)) {
      showToast('A role name may only contain letters, digits, _ . : and -', 'error');
      return;
    }
    if (this.getRoles().some((role) => role.name === name)) {
      showToast(`A role named "${name}" already exists`, 'error');
      return;
    }
    const bpmnFactory = this.modeler.get('bpmnFactory' as never) as any;
    const resource = bpmnFactory.create('bpmn:Resource', { name });
    resource.$parent = definitions;
    definitions.rootElements = [...(definitions.rootElements || []), resource];
    this.renderPropertiesPanel(null);
  }

  private removeRole(id: string): void {
    const definitions = this.modeler.getDefinitions() as { rootElements?: any[] } | undefined;
    const role = this.getRoles().find((candidate) => candidate.id === id);
    if (!definitions || !role) return;
    // drop the tasks' references first, so no potentialOwner dangles
    for (const element of this.getProcessElement()?.flowElements || []) {
      if (element.$type === 'bpmn:UserTask' && element.resources) {
        element.resources = element.resources.filter((owner: any) => owner.resourceRef !== role);
      }
    }
    definitions.rootElements = (definitions.rootElements || []).filter((element: any) => element !== role);
    this.renderPropertiesPanel(null);
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
      showToast(`A variable named "${name}" already exists`, 'error');
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

  // <bpmn:definitions version="..."> is not a declared bpmn-moddle property, so it only
  // survives modeler.saveXML() if tracked in $attrs. bpmn-js's bundled bpmn-moddle (v10,
  // via moddle v8) exposes $attrs as a read-only getter that always returns a live,
  // mutable object (even {} when empty) - reassigning it (`definitions.$attrs = {...}`)
  // throws "Cannot set property $attrs of #<Base> which has only a getter", which was
  // being silently swallowed since it's thrown from a DOM event handler, so the version
  // never actually got written. Mutating a property on the existing object works fine.
  private setDefinitionsVersion(value: string): void {
    if (!value) {
      return;
    }
    const definitions = this.modeler.getDefinitions() as { $attrs?: Record<string, string> } | undefined;
    if (definitions?.$attrs) {
      definitions.$attrs.version = value;
    }
  }

  private bindConfigInput(inputId: string, apply: (value: string) => void): void {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    input?.addEventListener('change', () => apply(input.value));
  }

  /**
   * Swaps the script task's textarea for a Monaco editor once Monaco is
   * loaded (the textarea stays if it can't be). The script is saved when the
   * editor loses focus - like the textarea's change event - since every save
   * re-renders this panel.
   */
  private mountScriptEditor(element: any): void {
    const generation = ++this.scriptEditorGeneration;
    loadMonaco().then(() => {
      const textarea = document.getElementById('bpmn-prop-script') as HTMLTextAreaElement | null;
      // the panel was re-rendered (or another element selected) meanwhile
      if (!textarea || generation !== this.scriptEditorGeneration) return;

      const host = document.createElement('div');
      host.className = 'script-monaco';
      textarea.replaceWith(host);
      const editor = monaco.editor.create(host, {
        value: textarea.value,
        language: 'javascript',
        theme: 'vs',
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        lineNumbersMinChars: 3,
        folding: false,
        fontSize: 12,
        wordWrap: 'on',
        tabSize: 2,
        insertSpaces: true,
        fixedOverflowWidgets: true,
      });
      const save = () => {
        if (this.scriptEditor?.editor !== editor) return; // disposed
        const script = editor.getValue();
        if (script !== (element.businessObject.script || '')) {
          (this.modeler.get('modeling' as never) as any).updateProperties(element, { script });
        }
      };
      editor.onDidBlurEditorText(save);
      this.scriptEditor = { editor, save };
    }).catch(() => {
      // Monaco unavailable (offline?) - the plain textarea keeps working
    });
  }

  private disposeScriptEditor(): void {
    this.scriptEditorGeneration++;
    if (!this.scriptEditor) return;
    const { editor } = this.scriptEditor;
    this.scriptEditor = null;
    editor.dispose();
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
      humanTaskNode: 'bpmn:UserTask',
      humanTask: 'bpmn:UserTask',
      catchEventNode: 'bpmn:IntermediateCatchEvent',
      catchEvent: 'bpmn:IntermediateCatchEvent',
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


