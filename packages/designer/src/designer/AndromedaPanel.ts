import { ContextMenu } from './ContextMenu';

/** What the tree shows - a projection of WorkflowModel plus the highlighted node. */
export interface WorkflowTreeState {
  deploymentId: string;
  version: string;
  processes: { id: string; processDef: string }[];
  /** the process in the editor */
  activeId: string | null;
  /** the node whose properties are showing: the root, or a process */
  selected: 'workflow' | string | null;
}

/** `select-process` / `remove-process` event detail */
export interface ProcessDetail {
  id: string;
}

const PACKAGE_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.3 7 12 12 20.7 7"/>
    <line x1="12" y1="22" x2="12" y2="12"/>
    <polyline points="7.5 4.6 16.5 9.6"/>
  </svg>`;

const PROCESS_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="4.5" cy="12" r="2.5"/>
    <rect x="9.5" y="8.5" width="7" height="7" rx="1.5"/>
    <circle cx="20" cy="12" r="2.5" stroke-width="2.6"/>
    <line x1="7" y1="12" x2="9.5" y2="12"/>
    <line x1="16.5" y1="12" x2="17.5" y2="12"/>
  </svg>`;

const PLUS_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>`;

/**
 * The Andromeda panel: the workflow as a tree - the deployment (container id
 * and version) at the root, its processes underneath. Lives in a dock panel
 * opened from the left menu (see Workspace). Clicking a node fires
 * `select-workflow` / `select-process`; the + button and the context menu
 * fire `add-process`, a process's context menu also `remove-process`.
 * Workspace turns those into properties views, editor tabs and dialogs.
 */
export class AndromedaPanel extends HTMLElement {
  private shadow: ShadowRoot;
  private rendered = false;
  private contextMenu: ContextMenu | null = null;
  private state: WorkflowTreeState = { deploymentId: '', version: '', processes: [], activeId: null, selected: null };

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    // the dock moves this element between containers (panel closed and
    // reopened) - render and wire listeners only once
    if (this.rendered) return;
    this.rendered = true;
    this.render();
    this.addEventListeners();
    this.updateTree();
  }

  setState(state: WorkflowTreeState): void {
    this.state = state;
    if (this.rendered) this.updateTree();
  }

  private emit<T>(name: string, detail?: T): void {
    this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
  }

  private addEventListeners(): void {
    this.shadow.getElementById('add-process')?.addEventListener('click', () => this.emit('add-process'));

    const tree = this.shadow.getElementById('tree');
    tree?.addEventListener('click', (event) => {
      const node = (event.target as HTMLElement).closest<HTMLElement>('.node');
      if (!node) return;
      this.select(node);
    });
    tree?.addEventListener('keydown', (event) => {
      const node = (event.target as HTMLElement).closest<HTMLElement>('.node');
      if (!node || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      this.select(node);
    });
    // right-click: the node's actions (the root and the empty area: add a process)
    this.shadow.getElementById('body')?.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const node = (event.target as HTMLElement).closest<HTMLElement>('.node');
      const processId = node?.dataset.processId;
      const items = [{ id: 'add', label: 'Add process…', icon: PLUS_ICON, action: () => this.emit('add-process') }];
      if (processId) {
        items.push({ id: 'remove', label: 'Remove process', icon: '', action: () => this.emit<ProcessDetail>('remove-process', { id: processId }) });
      }
      this.contextMenu ??= new ContextMenu();
      this.contextMenu.show(items, { x: event.clientX, y: event.clientY });
    });
  }

  private select(node: HTMLElement): void {
    if (node.dataset.processId) {
      this.emit<ProcessDetail>('select-process', { id: node.dataset.processId });
    } else {
      this.emit('select-workflow');
    }
  }

  private updateTree(): void {
    const tree = this.shadow.getElementById('tree');
    if (!tree) return;
    const { deploymentId, version, processes, activeId, selected } = this.state;
    tree.innerHTML = `
      <div class="node root ${selected === 'workflow' ? 'selected' : ''}" tabindex="0" role="treeitem" aria-expanded="true" title="Workflow - click to edit the container id and version">
        <span class="icon">${PACKAGE_ICON}</span>
        <span class="label">${escapeHtml(deploymentId)}</span>
        <span class="version">${escapeHtml(version)}</span>
      </div>
      <div class="children" role="group">
        ${processes.map((process) => `
          <div class="node process ${selected === process.id ? 'selected' : ''} ${activeId === process.id ? 'active' : ''}"
               tabindex="0" role="treeitem" data-process-id="${escapeHtml(process.id)}" title="${escapeHtml(process.processDef)} - click to edit">
            <span class="icon">${PROCESS_ICON}</span>
            <span class="label">${escapeHtml(process.processDef)}</span>
          </div>
        `).join('')}
        ${processes.length === 0 ? '<div class="empty">No process yet - use + to add one.</div>' : ''}
      </div>
    `;
  }

  private render(): void {
    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          font-family: var(--font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
          color: var(--text, #1f2340);
        }

        .toolbar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 10px 8px 12px;
          border-bottom: 1px solid var(--glass-divider);
        }

        .title {
          flex: 1;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .btn {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border-radius: 8px;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.6);
          background: var(--glass-control-bg);
          color: var(--text-muted);
          transition: all 0.2s;
        }

        .btn svg {
          width: 16px;
          height: 16px;
        }

        .btn:hover {
          background: rgba(255, 255, 255, 0.85);
          color: var(--accent);
        }

        .btn:focus-visible {
          outline: none;
          box-shadow: var(--accent-ring);
        }

        .body {
          flex: 1;
          overflow-y: auto;
          padding: 10px 8px;
        }

        .node {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 13px;
          user-select: none;
          border: 1px solid transparent;
          transition: background 0.15s, border-color 0.15s;
        }

        .node:hover {
          background: rgba(255, 255, 255, 0.5);
        }

        .node:focus-visible {
          outline: none;
          box-shadow: var(--accent-ring);
        }

        .node.selected {
          background: rgba(255, 255, 255, 0.7);
          border-color: rgba(255, 255, 255, 0.9);
        }

        .node .icon {
          flex: 0 0 auto;
          width: 18px;
          height: 18px;
          display: inline-flex;
          color: var(--text-muted);
        }

        .node .icon svg {
          width: 100%;
          height: 100%;
        }

        .node.root {
          font-weight: 600;
        }

        .node.root .icon {
          color: #b26a00;
        }

        .node .label {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .node .version {
          flex: 0 0 auto;
          font-size: 11px;
          font-weight: 600;
          padding: 1px 7px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.55);
          color: var(--text-muted);
        }

        .children {
          margin: 2px 0 0 13px;
          padding-left: 10px;
          border-left: 1px solid var(--glass-divider);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .node.process .icon {
          color: #0d9488;
        }

        /* the process in the editor */
        .node.process.active .label {
          font-weight: 600;
          color: var(--accent);
        }

        .empty {
          padding: 8px;
          font-size: 12px;
          font-style: italic;
          color: var(--text-subtle);
        }
      </style>

      <div class="toolbar">
        <span class="title">Workflow</span>
        <button id="add-process" class="btn" title="Add a process">${PLUS_ICON}</button>
      </div>
      <div class="body" id="body">
        <div id="tree" role="tree" aria-label="Workflow"></div>
      </div>
    `;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

customElements.define('andromeda-workflow-panel', AndromedaPanel);
