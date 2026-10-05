import {
  createDockview,
  themeLightSpaced,
  type AddPanelOptions,
  type DockviewApi,
  type DockviewIDisposable,
  type DockviewTheme,
  type GroupPanelPartInitParameters,
  type IContentRenderer,
} from 'dockview-core';
import type { BPMNDesigner } from '../designer';
import { GalaxyPanel, type OpenInstancesDetail, type OpenLogsDetail } from '../designer/GalaxyPanel';
import { LogViewer } from '../designer/LogViewer';
import { ProcessInstancesView } from '../designer/ProcessInstancesView';

/**
 * The designer's dockable workspace (dockview-core, framework-free).
 *
 * Panels wrap long-lived DOM that already exists in index.html (the bpmn-js
 * canvas, the Monaco XML editor, the properties panel) or is created once
 * here (the Galaxy registry). Dockview creates a renderer each time a panel
 * is opened; the renderer borrows that element and hands it back to the
 * hidden #panel-sources holder when the panel is closed, so bpmn-js/Monaco
 * keep their state across close/reopen.
 *
 * The left menu (.side-menu) toggles the side panels and brings the editors
 * to the front, and the layout is remembered per browser.
 */

type PanelId = 'diagram' | 'xml' | 'properties' | 'galaxy';
type SidePanelId = 'properties' | 'galaxy';

interface PanelSpec {
  title: string;
  /** the element shown inside the panel - resolved once, see Workspace constructor */
  element: HTMLElement;
  /** where the panel goes when (re)opened */
  position: (api: DockviewApi) => Partial<AddPanelOptions>;
  onVisibilityChange?: (visible: boolean) => void;
  onResize?: () => void;
}

const LAYOUT_STORAGE_KEY = 'andromeda.designer.layout';
// galaxy registrations change as containers start/stop - refresh while visible
const GALAXY_REFRESH_MS = 10_000;
const SIDE_PANELS: SidePanelId[] = ['properties', 'galaxy'];
const SIZE_TOLERANCE_PX = 12;

const theme: DockviewTheme = {
  ...themeLightSpaced,
  name: 'andromedaGlass',
  className: `${themeLightSpaced.className} andromeda-dock`,
};

class BorrowedElementRenderer implements IContentRenderer {
  readonly element = document.createElement('div');
  private disposables: DockviewIDisposable[] = [];

  constructor(id: PanelId, private spec: PanelSpec, private holder: HTMLElement) {
    this.element.className = `dock-panel dock-panel-${id}`;
    this.element.appendChild(spec.element);
  }

  init(params: GroupPanelPartInitParameters): void {
    this.disposables.push(
      params.api.onDidVisibilityChange((event) => this.spec.onVisibilityChange?.(event.isVisible)),
      params.api.onDidDimensionsChange(() => this.spec.onResize?.()),
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
// per-container panels (logs, process instances) share one group under the diagram
const BOTTOM_PANEL_PREFIXES = ['logs:', 'instances:'];
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

  constructor() {
    this.element.className = 'dock-panel dock-panel-instances';
    this.element.appendChild(this.view);
  }

  init(params: GroupPanelPartInitParameters): void {
    const { galaxyUrl, deploymentId } = params.params as unknown as InstancesPanelParams;
    this.view.open(galaxyUrl, deploymentId);
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

export class Workspace {
  private api!: DockviewApi;
  private specs: Record<PanelId, PanelSpec>;
  // constructed directly (not createElement) so the import - and with it the
  // custom element registration - isn't elided as a type-only import
  private galaxyPanel = new GalaxyPanel();
  private galaxyTimer: number | null = null;
  // attached after init(): bpmn-js must be created on a canvas the dock has
  // already laid out, or its first fit-to-viewport measures a hidden element
  private designer: BPMNDesigner | null = null;
  // side panels keep their width while other panels open/close around them
  // (dockview would otherwise redistribute the freed/needed space evenly)
  private sideWidths: Record<SidePanelId, number> = { properties: 300, galaxy: 340 };

  constructor(private root: HTMLElement, private holder: HTMLElement, private menu: HTMLElement) {
    // resolve every panel element now, while they're all parked in the
    // holder - once a panel closes its element is detached from the document
    // and can no longer be found by id
    const byId = (id: string) => {
      const element = document.getElementById(id);
      if (!element) throw new Error(`workspace: #${id} not found`);
      return element;
    };
    this.holder.appendChild(this.galaxyPanel);

    this.specs = {
      diagram: {
        title: 'Diagram',
        element: byId('canvas-container'),
        position: () => ({}),
        onVisibilityChange: (visible) => visible && this.designer?.showDesigner(),
        onResize: () => this.designer?.showDesigner(),
      },
      xml: {
        title: 'XML',
        element: byId('xml-editor'),
        position: (api) => api.getPanel('diagram')
          ? { position: { referencePanel: 'diagram', direction: 'within' }, inactive: true }
          : {},
        onVisibilityChange: (visible) => void this.designer?.setXMLEditorVisible(visible),
        onResize: () => this.designer?.layoutXMLEditor(),
      },
      properties: {
        title: 'Properties',
        element: byId('properties-panel'),
        position: () => ({ position: { direction: 'right' }, initialWidth: this.sideWidths.properties }),
      },
      galaxy: {
        title: 'Galaxy',
        element: this.galaxyPanel,
        position: () => ({ position: { direction: 'left' }, initialWidth: this.sideWidths.galaxy }),
        onVisibilityChange: (visible) => this.setGalaxyActive(visible),
      },
    };
  }

  init(): void {
    this.api = createDockview(this.root, {
      theme,
      // keep a hidden tab's content attached to the document: bpmn-js can't
      // measure (or fit) a detached canvas, and the designer looks up its
      // properties/XML elements by id
      defaultRenderer: 'always',
      createComponent: ({ name }) => {
        if (name === LOGS_COMPONENT) {
          return new LogPanelRenderer();
        }
        if (name === INSTANCES_COMPONENT) {
          return new InstancesPanelRenderer();
        }
        const spec = this.specs[name as PanelId];
        if (!spec) throw new Error(`workspace: unknown panel "${name}"`);
        return new BorrowedElementRenderer(name as PanelId, spec, this.holder);
      },
    });

    if (!this.restoreLayout()) {
      this.applyDefaultLayout();
    }
    this.rememberSideWidths();

    this.api.onDidLayoutChange(() => this.saveLayout());
    this.api.onDidAddPanel(() => this.afterPanelsChanged());
    this.api.onDidRemovePanel(() => this.afterPanelsChanged());
    this.api.onDidActivePanelChange(() => this.updateMenu());
    // a finished divider drag is the user choosing a side panel's width
    this.root.addEventListener('pointerup', () => this.rememberSideWidths());

    this.menu.addEventListener('click', (event) => {
      const item = (event.target as HTMLElement).closest<HTMLElement>('[data-panel]');
      if (item) this.toggle(item.dataset.panel as PanelId);
    });
    this.galaxyPanel.addEventListener('open-logs', (event) => {
      this.openLogs((event as CustomEvent<OpenLogsDetail>).detail);
    });
    this.galaxyPanel.addEventListener('open-instances', (event) => {
      this.openInstances((event as CustomEvent<OpenInstancesDetail>).detail);
    });
    this.updateMenu();
  }

  /**
   * Opens (or brings to front) the live log panel of one container. Log
   * panels share a group docked under the diagram.
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

  /** Per-container panels stack as tabs in one group docked under the diagram. */
  private bottomPanelPosition(): Partial<AddPanelOptions> {
    const sibling = this.api.panels.find((panel) => BOTTOM_PANEL_PREFIXES.some((prefix) => panel.id.startsWith(prefix)));
    if (sibling) {
      return { position: { referencePanel: sibling.id, direction: 'within' } } as Partial<AddPanelOptions>;
    }
    if (this.api.getPanel('diagram')) {
      return { position: { referencePanel: 'diagram', direction: 'below' }, initialHeight: BOTTOM_PANEL_HEIGHT } as Partial<AddPanelOptions>;
    }
    return {};
  }

  /** Connects the designer and replays visibility for the panels already showing. */
  attachDesigner(designer: BPMNDesigner): void {
    this.designer = designer;
    for (const panel of this.api.panels) {
      if (panel.api.isVisible) {
        this.specs[panel.id as PanelId]?.onVisibilityChange?.(true);
      }
    }
  }

  /** Opens a panel (or brings it to front); side panels close when already open. */
  toggle(id: PanelId): void {
    const panel = this.api.getPanel(id);
    if (panel && this.isSidePanel(id)) {
      this.rememberSideWidths();
      panel.api.close();
      return;
    }
    this.open(id);
  }

  open(id: PanelId): void {
    const existing = this.api.getPanel(id);
    if (existing) {
      existing.api.setActive();
      return;
    }
    this.rememberSideWidths();
    const spec = this.specs[id];
    this.api.addPanel({ id, component: id, title: spec.title, ...spec.position(this.api) } as AddPanelOptions);
  }

  /** Clears the remembered layout and rebuilds the default one. */
  resetLayout(): void {
    try {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    } catch {
      // ignore
    }
    this.sideWidths = { properties: 300, galaxy: 340 };
    this.applyDefaultLayout();
  }

  private applyDefaultLayout(): void {
    this.api.clear();
    this.open('diagram');
    this.open('xml');
    this.open('properties');
    this.api.getPanel('diagram')?.api.setActive();
  }

  private restoreLayout(): boolean {
    try {
      const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (!saved) return false;
      this.api.fromJSON(JSON.parse(saved));
      // a layout saved by an older build may reference panels that no longer exist
      return this.api.panels.length > 0
        && this.api.panels.every((p) => p.id in this.specs || BOTTOM_PANEL_PREFIXES.some((prefix) => p.id.startsWith(prefix)));
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

  private isSidePanel(id: PanelId): id is SidePanelId {
    return (SIDE_PANELS as PanelId[]).includes(id);
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
    // after dockview has finished re-laying out the grid (a timeout rather
    // than requestAnimationFrame, which never fires in a background tab)
    window.setTimeout(() => {
      for (const id of SIDE_PANELS) {
        this.soloSidePanel(id)?.group.api.setSize({ width: this.sideWidths[id] });
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
      const id = item.dataset.panel as PanelId;
      const open = !!this.api.getPanel(id);
      item.classList.toggle('open', open);
      item.classList.toggle('active', open && id === active);
      item.setAttribute('aria-pressed', String(open));
    });
  }
}
