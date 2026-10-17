import {
  createDockview,
  themeLightSpaced,
  type AddPanelOptions,
  type DockviewApi,
  type DockviewIDisposable,
  type DockviewTheme,
  type GroupPanelPartInitParameters,
  type IContentRenderer,
  type IDockviewPanel,
  type IGroupHeaderProps,
  type IHeaderActionsRenderer,
} from 'dockview-core';
import type { BPMNDesigner } from '../designer';
import { GalaxyPanel, type OpenInstanceDetail, type OpenInstancesDetail, type OpenLogsDetail, type OpenTasksDetail } from '../designer/GalaxyPanel';
import { AndromedaPanel, type ProcessDetail } from '../designer/AndromedaPanel';
import { TasksView } from '../designer/TasksView';
import { LogViewer } from '../designer/LogViewer';
import { ProcessInstancesView } from '../designer/ProcessInstancesView';
import { InstanceViewerModal } from '../designer/InstanceViewerModal';
import type { WorkflowModel, WorkflowProcess } from '../designer/WorkflowModel';

/**
 * The designer's dockable workspace (dockview-core, framework-free).
 *
 * Side panels wrap long-lived DOM that already exists in index.html (the
 * properties panel) or is created once here (the Galaxy registry, the
 * Andromeda workflow tree). Dockview creates a renderer each time a panel is
 * opened; the renderer borrows that element and hands it back to the hidden
 * #panel-sources holder when the panel is closed, so the panels keep their
 * state across close/reopen.
 *
 * Every process of the workflow gets a tab of its own ("<processDef> · <version>")
 * over the editor. There is one editor (#canvas-container: the bpmn-js canvas
 * and the XML editor behind it): it is moved into whichever process tab is
 * active, and the designer switches the diagram to that process.
 *
 * The left menu (.side-menu) toggles the Galaxy and Andromeda panels, and the
 * layout is remembered per browser.
 */

type SidePanelId = 'properties' | 'galaxy' | 'andromeda';

interface PanelSpec {
  title: string;
  /** the element shown inside the panel - resolved once, see Workspace constructor */
  element: HTMLElement;
  initialWidth: number;
  /** where the panel goes when (re)opened */
  position: (api: DockviewApi) => Partial<AddPanelOptions>;
  onVisibilityChange?: (visible: boolean) => void;
}

const LAYOUT_STORAGE_KEY = 'andromeda.designer.layout';
// galaxy registrations change as containers start/stop - refresh while visible
const GALAXY_REFRESH_MS = 10_000;
const SIDE_PANELS: SidePanelId[] = ['properties', 'galaxy', 'andromeda'];
const DEFAULT_SIDE_WIDTHS: Record<SidePanelId, number> = { properties: 300, galaxy: 340, andromeda: 220 };
// the editor keeps at least 80% of the dock: the properties panel never grows past this
const PROPERTIES_MAX_RATIO = 0.2;
const SIZE_TOLERANCE_PX = 12;

const DEPLOY_ICON = `
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M7 4.5v15a1 1 0 0 0 1.52.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z"/>
  </svg>`;
const STOP_ICON = `
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <rect x="5.5" y="5.5" width="13" height="13" rx="2"/>
  </svg>`;

/**
 * Deploy / Stop, at the right of the process tabs' header (icons only).
 * Deploy compiles every process into the container and starts it; Stop
 * stops that container through Galaxy. Hidden on groups without process tabs.
 */
class ProcessHeaderActions implements IHeaderActionsRenderer {
  readonly element = document.createElement('div');
  private disposables: DockviewIDisposable[] = [];
  private deploy: HTMLButtonElement;
  private stop: HTMLButtonElement;

  constructor(private workspace: Workspace) {
    this.element.className = 'process-header-actions';
    this.deploy = this.button('deploy', DEPLOY_ICON, 'Deploy - compile every process of the workflow into a container and start it');
    this.stop = this.button('stop', STOP_ICON, 'Stop the workflow\'s running container (through Galaxy)');
    this.deploy.addEventListener('click', () => void this.run(this.deploy, () => this.workspace.deploy()));
    this.stop.addEventListener('click', () => void this.run(this.stop, () => this.workspace.stop()));
    this.element.append(this.deploy, this.stop);
    this.setRunning(false);
  }

  /** Stop is only offered while Galaxy lists a container of this workflow. */
  setRunning(running: boolean): void {
    this.stop.hidden = !running;
  }

  private button(kind: string, icon: string, title: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `process-header-action process-header-${kind}`;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.innerHTML = icon;
    return button;
  }

  private async run(button: HTMLButtonElement, action: () => Promise<void>): Promise<void> {
    if (button.disabled) return;
    button.disabled = true;
    button.classList.add('busy');
    try {
      await action();
    } finally {
      button.disabled = false;
      button.classList.remove('busy');
    }
  }

  init(params: IGroupHeaderProps): void {
    const update = () => {
      this.element.hidden = !params.group.panels.some((panel) => panel.id.startsWith(PROCESS_PREFIX));
    };
    this.disposables.push(
      params.api.onDidActivePanelChange(update),
      params.containerApi.onDidAddPanel(update),
      params.containerApi.onDidRemovePanel(update),
      params.containerApi.onDidMovePanel(update),
    );
    update();
    this.workspace.registerHeaderActions(this);
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.workspace.releaseHeaderActions(this);
  }
}

// a container of the workflow may appear/disappear in Galaxy at any time
const RUNNING_REFRESH_MS = 10_000;

const theme: DockviewTheme = {
  ...themeLightSpaced,
  name: 'andromedaGlass',
  className: `${themeLightSpaced.className} andromeda-dock`,
};

class BorrowedElementRenderer implements IContentRenderer {
  readonly element = document.createElement('div');
  private disposables: DockviewIDisposable[] = [];

  constructor(id: SidePanelId, private spec: PanelSpec, private holder: HTMLElement) {
    this.element.className = `dock-panel dock-panel-${id}`;
    this.element.appendChild(spec.element);
  }

  init(params: GroupPanelPartInitParameters): void {
    this.disposables.push(
      params.api.onDidVisibilityChange((event) => this.spec.onVisibilityChange?.(event.isVisible)),
    );
    this.spec.onVisibilityChange?.(params.api.isVisible);
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.spec.onVisibilityChange?.(false);
    // give the element back so a reopened panel finds it intact
    this.holder.appendChild(this.spec.element);
  }
}

/** params of a `logs` panel - also what a saved layout reopens it with */
interface LogPanelParams {
  url: string;
}

const LOGS_COMPONENT = 'logs';
const INSTANCES_COMPONENT = 'instances';
const TASKS_COMPONENT = 'tasks';
const PROCESS_COMPONENT = 'process';
/** a process tab's panel id is `process:<WorkflowProcess.id>` */
const PROCESS_PREFIX = 'process:';
// per-container panels (logs, process instances, tasks) share one group under the editor
const BOTTOM_PANEL_PREFIXES = ['logs:', 'instances:', 'tasks:'];

/** params of a `tasks` panel - also what a saved layout reopens it with */
type TasksPanelParams = OpenTasksDetail;

/** A container's human task worklist - see TasksView. */
class TasksPanelRenderer implements IContentRenderer {
  readonly element = document.createElement('div');
  private view = new TasksView();

  constructor(private authHeaders: () => Record<string, string>) {
    this.element.className = 'dock-panel dock-panel-tasks';
    this.element.appendChild(this.view);
  }

  init(params: GroupPanelPartInitParameters): void {
    const { host, port, deploymentId, processDefs } = params.params as unknown as TasksPanelParams;
    this.view.open({ host, port, deploymentId, processDefs, authHeaders: this.authHeaders });
  }

  dispose(): void {
    this.view.stop();
  }
}
const BOTTOM_PANEL_HEIGHT = 300;

/** params of an `instances` panel - also what a saved layout reopens it with */
interface InstancesPanelParams {
  galaxyUrl: string;
  deploymentId: string;
}

/** One deployment's process instances, with details/variables of the selected one. */
class InstancesPanelRenderer implements IContentRenderer {
  readonly element = document.createElement('div');
  private view = new ProcessInstancesView();
  private viewer = new InstanceViewerModal();

  constructor(private readonly authHeaders: () => Record<string, string>) {
    this.element.className = 'dock-panel dock-panel-instances';
    this.element.appendChild(this.view);
  }

  init(params: GroupPanelPartInitParameters): void {
    const { galaxyUrl, deploymentId } = params.params as unknown as InstancesPanelParams;
    this.view.open(galaxyUrl, deploymentId);
    // a clicked instance opens on its diagram
    this.view.onOpenInstance = (processInstanceId) => {
      void this.viewer.open({ galaxyUrl, processInstanceId, authHeaders: this.authHeaders });
    };
  }

  dispose(): void {
    this.view.stop();
  }
}

/** A container's live log stream - one panel (and one EventSource) per container. */
class LogPanelRenderer implements IContentRenderer {
  readonly element = document.createElement('div');
  private viewer = new LogViewer();

  constructor() {
    this.element.className = 'dock-panel dock-panel-logs';
    this.element.appendChild(this.viewer);
  }

  init(params: GroupPanelPartInitParameters): void {
    this.viewer.connect((params.params as unknown as LogPanelParams).url);
  }

  dispose(): void {
    this.viewer.disconnect();
  }
}

/**
 * A process tab. Hosts the (single) editor while it is the active tab;
 * otherwise - e.g. dragged next to another process tab - it shows a button
 * that makes it active.
 */
class ProcessPanelRenderer implements IContentRenderer {
  readonly element = document.createElement('div');
  private disposables: DockviewIDisposable[] = [];

  constructor(readonly processId: string, private workspace: Workspace) {
    this.element.className = 'dock-panel dock-panel-process';
    const placeholder = document.createElement('button');
    placeholder.type = 'button';
    placeholder.className = 'process-placeholder';
    placeholder.textContent = 'Edit this process here';
    placeholder.addEventListener('click', () => this.workspace.openProcess(this.processId));
    this.element.appendChild(placeholder);
    this.workspace.registerProcessHost(this.processId, this.element);
  }

  init(params: GroupPanelPartInitParameters): void {
    this.disposables.push(
      params.api.onDidDimensionsChange(() => this.workspace.onProcessPanelResized(this.processId)),
    );
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.workspace.releaseProcessHost(this.processId);
  }
}

export class Workspace {
  private api!: DockviewApi;
  private specs: Record<SidePanelId, PanelSpec>;
  // constructed directly (not createElement) so the import - and with it the
  // custom element registration - isn't elided as a type-only import
  private galaxyPanel = new GalaxyPanel();
  private andromedaPanel = new AndromedaPanel();
  private galaxyTimer: number | null = null;
  /** shows a process instance on its diagram - see the `open-instance` listener */
  private instanceViewer = new InstanceViewerModal();
  // attached after init(): bpmn-js must be created on a canvas the dock has
  // already laid out, or its first fit-to-viewport measures a hidden element
  private designer: BPMNDesigner | null = null;
  // side panels keep their width while other panels open/close around them
  // (dockview would otherwise redistribute the freed/needed space evenly)
  private sideWidths: Record<SidePanelId, number> = { ...DEFAULT_SIDE_WIDTHS };
  /** the one editor, moved into the active process tab */
  private editor: HTMLElement;
  /** open process tabs' content elements, by WorkflowProcess.id */
  private processHosts = new Map<string, HTMLElement>();
  /** the tree node whose properties are showing */
  private treeSelection: 'workflow' | 'process' = 'process';
  /** the Deploy / Stop header of every group showing process tabs */
  private headerActions = new Set<ProcessHeaderActions>();
  private runningTimer: number | null = null;
  /** Galaxy lists a container of this workflow - what enables Stop */
  private running = false;
  /** asks main.ts to show the "Add a process" dialog */
  onAddProcess?: () => void;
  /** asks main.ts to remove a process (after confirming) */
  onRemoveProcess?: (process: WorkflowProcess) => void;

  constructor(private root: HTMLElement, private holder: HTMLElement, private menu: HTMLElement, private workflow: WorkflowModel) {
    // resolve every panel element now, while they're all parked in the
    // holder - once a panel closes its element is detached from the document
    // and can no longer be found by id
    const byId = (id: string) => {
      const element = document.getElementById(id);
      if (!element) throw new Error(`workspace: #${id} not found`);
      return element;
    };
    this.holder.appendChild(this.galaxyPanel);
    this.holder.appendChild(this.andromedaPanel);
    this.editor = byId('canvas-container');

    this.specs = {
      properties: {
        title: 'Properties',
        element: byId('properties-panel'),
        initialWidth: DEFAULT_SIDE_WIDTHS.properties,
        position: () => ({ position: { direction: 'right' } }),
      },
      galaxy: {
        title: 'Galaxy',
        element: this.galaxyPanel,
        initialWidth: DEFAULT_SIDE_WIDTHS.galaxy,
        position: () => ({ position: { direction: 'left' } }),
        onVisibilityChange: (visible) => this.setGalaxyActive(visible),
      },
      andromeda: {
        title: 'Andromeda',
        element: this.andromedaPanel,
        initialWidth: DEFAULT_SIDE_WIDTHS.andromeda,
        position: () => ({ position: { direction: 'left' } }),
      },
    };
  }

  init(): void {
    this.api = createDockview(this.root, {
      theme,
      // keep a hidden tab's content attached to the document: bpmn-js can't
      // measure (or fit) a detached canvas, and the designer looks up its
      // properties elements by id
      defaultRenderer: 'always',
      createRightHeaderActionComponent: () => new ProcessHeaderActions(this),
      createComponent: ({ id, name }) => {
        if (name === LOGS_COMPONENT) {
          return new LogPanelRenderer();
        }
        if (name === INSTANCES_COMPONENT) {
          return new InstancesPanelRenderer(() => this.designer?.getAuthHeaders() ?? {});
        }
        if (name === TASKS_COMPONENT) {
          return new TasksPanelRenderer(() => this.designer?.getAuthHeaders() ?? {});
        }
        if (name === PROCESS_COMPONENT) {
          return new ProcessPanelRenderer(id.slice(PROCESS_PREFIX.length), this);
        }
        const spec = this.specs[name as SidePanelId];
        if (!spec) throw new Error(`workspace: unknown panel "${name}"`);
        return new BorrowedElementRenderer(name as SidePanelId, spec, this.holder);
      },
    });

    if (!this.restoreLayout()) {
      this.applyDefaultLayout();
    }
    this.rememberSideWidths();

    this.api.onDidLayoutChange(() => this.saveLayout());
    this.api.onDidAddPanel(() => this.afterPanelsChanged());
    this.api.onDidRemovePanel(() => this.afterPanelsChanged());
    this.api.onDidActivePanelChange(() => {
      this.updateMenu();
      this.showActiveProcess();
    });
    // a finished divider drag is the user choosing a side panel's width
    this.root.addEventListener('pointerup', () => {
      this.rememberSideWidths();
      this.capPropertiesWidth();
    });
    window.addEventListener('resize', () => this.capPropertiesWidth());

    this.menu.addEventListener('click', (event) => {
      const item = (event.target as HTMLElement).closest<HTMLElement>('[data-panel]');
      if (item) this.toggle(item.dataset.panel as SidePanelId);
    });
    this.galaxyPanel.addEventListener('open-logs', (event) => {
      this.openLogs((event as CustomEvent<OpenLogsDetail>).detail);
    });
    this.galaxyPanel.addEventListener('open-instances', (event) => {
      this.openInstances((event as CustomEvent<OpenInstancesDetail>).detail);
    });
    this.galaxyPanel.addEventListener('open-instance', (event) => {
      const { galaxyUrl, processInstanceId } = (event as CustomEvent<OpenInstanceDetail>).detail;
      void this.instanceViewer.open({ galaxyUrl, processInstanceId, authHeaders: () => this.designer?.getAuthHeaders() ?? {} });
    });
    this.galaxyPanel.addEventListener('open-tasks', (event) => {
      this.openTasks((event as CustomEvent<OpenTasksDetail>).detail);
    });

    // the workflow tree
    this.andromedaPanel.addEventListener('select-workflow', () => {
      this.treeSelection = 'workflow';
      this.ensureOpen('properties');
      this.designer?.showWorkflowProperties();
      this.updateTree();
    });
    this.andromedaPanel.addEventListener('select-process', (event) => {
      const { id } = (event as CustomEvent<ProcessDetail>).detail;
      this.treeSelection = 'process';
      this.openProcess(id);
      this.ensureOpen('properties');
      this.designer?.showProcessProperties();
      this.updateTree();
    });
    this.andromedaPanel.addEventListener('add-process', () => this.onAddProcess?.());
    this.andromedaPanel.addEventListener('remove-process', (event) => {
      const process = this.workflow.get((event as CustomEvent<ProcessDetail>).detail.id);
      if (process) this.onRemoveProcess?.(process);
    });
    this.workflow.addEventListener('change', () => this.onWorkflowChanged());

    this.updateMenu();
    this.updateTree();
  }

  /**
   * Opens (or brings to front) the live log panel of one container. Log
   * panels share a group docked under the editor.
   */
  openLogs({ deploymentId, port, url }: OpenLogsDetail): void {
    const id = `logs:${deploymentId}:${port}`;
    const existing = this.api.getPanel(id);
    if (existing) {
      existing.api.setActive();
      return;
    }
    const params: LogPanelParams = { url };
    this.api.addPanel({
      id,
      component: LOGS_COMPONENT,
      title: `Logs · ${deploymentId}`,
      params,
      ...this.bottomPanelPosition(),
    } as AddPanelOptions);
  }

  /**
   * Opens (or brings to front) the process instances panel of one
   * deployment - opened by clicking its card in the Galaxy panel.
   */
  openInstances({ deploymentId, galaxyUrl }: OpenInstancesDetail): void {
    const id = `instances:${deploymentId}`;
    const existing = this.api.getPanel(id);
    if (existing) {
      existing.api.setActive();
      return;
    }
    const params: InstancesPanelParams = { galaxyUrl, deploymentId };
    this.api.addPanel({
      id,
      component: INSTANCES_COMPONENT,
      title: `Instances · ${deploymentId}`,
      params,
      ...this.bottomPanelPosition(),
    } as AddPanelOptions);
  }

  /** Opens (or brings to front) the human task worklist of one container. */
  openTasks(detail: OpenTasksDetail): void {
    const id = `tasks:${detail.deploymentId}:${detail.port}`;
    const existing = this.api.getPanel(id);
    if (existing) {
      existing.api.setActive();
      return;
    }
    const params: TasksPanelParams = { ...detail };
    this.api.addPanel({
      id,
      component: TASKS_COMPONENT,
      title: `Tasks · ${detail.deploymentId}`,
      params,
      ...this.bottomPanelPosition(),
    } as AddPanelOptions);
  }

  /** Per-container panels stack as tabs in one group docked under the editor. */
  private bottomPanelPosition(): Partial<AddPanelOptions> {
    const sibling = this.api.panels.find((panel) => BOTTOM_PANEL_PREFIXES.some((prefix) => panel.id.startsWith(prefix)));
    if (sibling) {
      return { position: { referencePanel: sibling.id, direction: 'within' } } as Partial<AddPanelOptions>;
    }
    const processPanel = this.processPanels()[0];
    if (processPanel) {
      return { position: { referencePanel: processPanel.id, direction: 'below' }, initialHeight: BOTTOM_PANEL_HEIGHT } as Partial<AddPanelOptions>;
    }
    return {};
  }

  /** Deploy (process tabs' header): compiles every process and starts the container. */
  async deploy(): Promise<void> {
    await this.designer?.compileAndDeploy();
    await this.refreshRunning();
  }

  /** Stop (process tabs' header): stops the workflow's running container through Galaxy. */
  async stop(): Promise<void> {
    await this.designer?.stopDeployment();
    await this.refreshRunning();
  }

  /** @internal a group header with Deploy / Stop appeared */
  registerHeaderActions(actions: ProcessHeaderActions): void {
    this.headerActions.add(actions);
    actions.setRunning(this.running);
  }

  /** @internal */
  releaseHeaderActions(actions: ProcessHeaderActions): void {
    this.headerActions.delete(actions);
  }

  /** Asks Galaxy whether a container of the workflow is registered, and shows/hides Stop. */
  private async refreshRunning(): Promise<void> {
    if (!this.designer) return;
    const containers = await this.designer.findRunningContainers();
    this.running = !!containers && containers.length > 0;
    this.headerActions.forEach((actions) => actions.setRunning(this.running));
  }

  private startRunningRefresh(): void {
    if (this.runningTimer !== null) return;
    void this.refreshRunning();
    this.runningTimer = window.setInterval(() => void this.refreshRunning(), RUNNING_REFRESH_MS);
  }

  /** Connects the designer and replays visibility for the panels already showing. */
  attachDesigner(designer: BPMNDesigner): void {
    this.designer = designer;
    designer.onPropertiesRequested = () => this.ensureOpen('properties');
    designer.onPropertiesViewChange = (view) => {
      this.treeSelection = view === 'workflow' ? 'workflow' : 'process';
      this.updateTree();
    };
    for (const panel of this.api.panels) {
      if (panel.api.isVisible) {
        this.specs[panel.id as SidePanelId]?.onVisibilityChange?.(true);
      }
    }
    this.showActiveProcess();
    this.startRunningRefresh();
  }

  /** Opens (or brings to front) a side panel; closes it when already open. */
  toggle(id: SidePanelId): void {
    const panel = this.api.getPanel(id);
    if (panel) {
      this.rememberSideWidths();
      panel.api.close();
      return;
    }
    this.open(id);
  }

  open(id: SidePanelId): void {
    const existing = this.api.getPanel(id);
    if (existing) {
      existing.api.setActive();
      return;
    }
    this.rememberSideWidths();
    const spec = this.specs[id];
    this.api.addPanel({
      id,
      component: id,
      title: spec.title,
      initialWidth: id === 'properties' ? Math.min(this.sideWidths[id], this.propertiesMaxWidth()) : this.sideWidths[id],
      ...spec.position(this.api),
    } as AddPanelOptions);
  }

  /** 20% of the dock - what the properties panel may take at most. */
  private propertiesMaxWidth(): number {
    return Math.max(160, Math.round(this.root.clientWidth * PROPERTIES_MAX_RATIO));
  }

  /** Shrinks the properties panel back under 20% of the dock after a drag or a window resize. */
  private capPropertiesWidth(): void {
    const panel = this.soloSidePanel('properties');
    if (!panel) return;
    const max = this.propertiesMaxWidth();
    if (panel.group.api.width > max + SIZE_TOLERANCE_PX) {
      this.sideWidths.properties = max;
      panel.group.api.setSize({ width: max });
    }
  }

  /** Opens (or brings to front) a process's tab - the editor follows it. */
  openProcess(processId: string): void {
    const process = this.workflow.get(processId);
    if (!process) return;
    const id = PROCESS_PREFIX + processId;
    const existing = this.api.getPanel(id);
    if (existing) {
      existing.api.setActive();
      // already the active panel: setActive fires no change event
      this.showActiveProcess();
      return;
    }
    this.rememberSideWidths();
    this.api.addPanel({
      id,
      component: PROCESS_COMPONENT,
      title: this.processTitle(process),
      ...this.processPanelPosition(),
    } as AddPanelOptions);
  }

  /** Process tabs share one group in the middle, between the side panels. */
  private processPanelPosition(): Partial<AddPanelOptions> {
    const sibling = this.processPanels()[0];
    if (sibling) {
      return { position: { referencePanel: sibling.id, direction: 'within' } } as Partial<AddPanelOptions>;
    }
    const bottom = this.api.panels.find((panel) => BOTTOM_PANEL_PREFIXES.some((prefix) => panel.id.startsWith(prefix)));
    if (bottom) {
      return { position: { referencePanel: bottom.id, direction: 'above' } } as Partial<AddPanelOptions>;
    }
    if (this.api.getPanel('properties')) {
      return { position: { referencePanel: 'properties', direction: 'left' } } as Partial<AddPanelOptions>;
    }
    const left = this.api.getPanel('andromeda') ?? this.api.getPanel('galaxy');
    if (left) {
      return { position: { referencePanel: left.id, direction: 'right' } } as Partial<AddPanelOptions>;
    }
    return {};
  }

  private processPanels(): IDockviewPanel[] {
    return this.api.panels.filter((panel) => panel.id.startsWith(PROCESS_PREFIX));
  }

  private processTitle(process: WorkflowProcess): string {
    return `${process.processDef} · ${this.workflow.version}`;
  }

  /** @internal a process tab opened - see ProcessPanelRenderer */
  registerProcessHost(processId: string, host: HTMLElement): void {
    this.processHosts.set(processId, host);
  }

  /** @internal a process tab closed - the editor, if it was there, goes back to the holder */
  releaseProcessHost(processId: string): void {
    const host = this.processHosts.get(processId);
    this.processHosts.delete(processId);
    if (host && this.editor.parentElement === host) {
      this.holder.appendChild(this.editor);
    }
  }

  /** @internal */
  onProcessPanelResized(processId: string): void {
    if (this.editor.parentElement === this.processHosts.get(processId)) {
      this.designer?.showDesigner();
    }
  }

  /**
   * Moves the editor into the active process tab and switches the diagram to
   * it. While a side panel is the active one, the editor stays where it is -
   * or, not in any tab yet (a restored layout), goes to the workflow's active
   * process's tab.
   */
  private showActiveProcess(): void {
    const active = this.api.activePanel;
    let processId = active?.id.startsWith(PROCESS_PREFIX) ? active.id.slice(PROCESS_PREFIX.length) : null;
    if (processId === null) {
      const mounted = [...this.processHosts.values()].some((host) => host === this.editor.parentElement);
      if (mounted) return;
      processId = this.workflow.activeId && this.processHosts.has(this.workflow.activeId)
        ? this.workflow.activeId
        : this.processHosts.keys().next().value ?? null;
    }
    const host = processId ? this.processHosts.get(processId) : undefined;
    if (!processId || !host || !this.workflow.get(processId)) return;
    if (this.editor.parentElement !== host) {
      host.appendChild(this.editor);
    }
    if (this.designer) {
      void this.designer.openProcess(processId);
    }
  }

  /** Opens a side panel if it is closed - without making it active (the canvas keeps the keyboard). */
  private ensureOpen(id: SidePanelId): void {
    if (!this.api.getPanel(id)) this.open(id);
  }

  /** Tabs follow renames/version changes and removed processes; the tree re-renders. */
  private onWorkflowChanged(): void {
    // a renamed deployment id means a different container to look for
    void this.refreshRunning();
    for (const panel of this.processPanels()) {
      const process = this.workflow.get(panel.id.slice(PROCESS_PREFIX.length));
      if (!process) {
        panel.api.close();
      } else if (panel.title !== this.processTitle(process)) {
        panel.api.setTitle(this.processTitle(process));
      }
    }
    this.updateTree();
  }

  private updateTree(): void {
    this.andromedaPanel.setState({
      deploymentId: this.workflow.deploymentId,
      version: this.workflow.version,
      processes: this.workflow.processes.map(({ id, processDef }) => ({ id, processDef })),
      activeId: this.workflow.activeId,
      selected: this.treeSelection === 'workflow' ? 'workflow' : this.workflow.activeId,
    });
  }

  /** Clears the remembered layout and rebuilds the default one. */
  resetLayout(): void {
    try {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    } catch {
      // ignore
    }
    this.sideWidths = { ...DEFAULT_SIDE_WIDTHS };
    this.applyDefaultLayout();
  }

  private applyDefaultLayout(): void {
    this.api.clear();
    this.processHosts.clear();
    const active = this.workflow.getActive() ?? this.workflow.processes[0];
    if (active) this.openProcess(active.id);
    this.open('properties');
    this.open('andromeda');
    if (active) this.api.getPanel(PROCESS_PREFIX + active.id)?.api.setActive();
  }

  private restoreLayout(): boolean {
    try {
      const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (!saved) return false;
      this.api.fromJSON(JSON.parse(saved));
      // a layout saved by an older build may reference panels that no longer exist
      const known = (id: string) => id in this.specs
        || BOTTOM_PANEL_PREFIXES.some((prefix) => id.startsWith(prefix))
        || id.startsWith(PROCESS_PREFIX);
      if (this.api.panels.length === 0 || !this.api.panels.every((p) => known(p.id))) return false;
      // process tabs of processes removed meanwhile (another browser tab)
      for (const panel of this.processPanels()) {
        if (!this.workflow.get(panel.id.slice(PROCESS_PREFIX.length))) panel.api.close();
      }
      // the editor must be reachable: at least the active process has a tab
      if (this.processPanels().length === 0) {
        const active = this.workflow.getActive() ?? this.workflow.processes[0];
        if (active) this.openProcess(active.id);
      }
      return true;
    } catch (error) {
      console.warn('Ignoring saved designer layout:', error);
      return false;
    }
  }

  private saveLayout(): void {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(this.api.toJSON()));
    } catch {
      // storage unavailable (private mode, quota) - the layout just isn't remembered
    }
  }

  /** A side panel sitting alone in its own group - the case whose width we manage. */
  private soloSidePanel(id: SidePanelId) {
    const panel = this.api.getPanel(id);
    return panel && panel.group.panels.length === 1 ? panel : undefined;
  }

  private rememberSideWidths(): void {
    for (const id of SIDE_PANELS) {
      const width = Math.round(this.soloSidePanel(id)?.group.api.width ?? 0);
      // the measured width runs a few px under what setSize was given (group
      // gap/border) - only a real resize should replace the remembered width,
      // or it would creep down a little on every open/close
      if (width > 0 && Math.abs(width - this.sideWidths[id]) > SIZE_TOLERANCE_PX) {
        this.sideWidths[id] = width;
      }
    }
  }

  private afterPanelsChanged(): void {
    this.updateMenu();
    this.showActiveProcess();
    // after dockview has finished re-laying out the grid (a timeout rather
    // than requestAnimationFrame, which never fires in a background tab)
    window.setTimeout(() => {
      for (const id of SIDE_PANELS) {
        const width = id === 'properties' ? Math.min(this.sideWidths[id], this.propertiesMaxWidth()) : this.sideWidths[id];
        this.soloSidePanel(id)?.group.api.setSize({ width });
      }
    }, 0);
  }

  private setGalaxyActive(visible: boolean): void {
    if (this.galaxyTimer !== null) {
      window.clearInterval(this.galaxyTimer);
      this.galaxyTimer = null;
    }
    if (!visible || !this.designer) return;

    const designer = this.designer;
    const refresh = () => {
      this.galaxyPanel.setGalaxyUrl(designer.getGalaxyUrl());
      this.galaxyPanel.setDeploymentService(designer.getDeploymentService());
      void this.galaxyPanel.load();
    };
    refresh();
    this.galaxyTimer = window.setInterval(refresh, GALAXY_REFRESH_MS);
  }

  private updateMenu(): void {
    const active = this.api.activePanel?.id;
    this.menu.querySelectorAll<HTMLElement>('[data-panel]').forEach((item) => {
      const id = item.dataset.panel as SidePanelId;
      const open = !!this.api.getPanel(id);
      item.classList.toggle('open', open);
      item.classList.toggle('active', open && id === active);
      item.setAttribute('aria-pressed', String(open));
    });
  }
}
