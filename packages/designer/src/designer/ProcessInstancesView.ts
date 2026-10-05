/**
 * Process instances of one deployment, with a details pane for the selected
 * instance (its info and persisted variables). Backed by Galaxy's read-only
 * runtime endpoints (GET /galaxy/process-instances and /galaxy/variables, see
 * the engine's src/modules/galaxy). Opened from a container card in the
 * Galaxy panel into a dock panel (see Workspace.openInstances).
 *
 * Refreshes itself while shown; data is only ever rendered as text.
 */

interface ProcessInstance {
  id: string;
  deploymentId: string;
  processDef: string;
  status: string;
  statusCode: number;
  lockedBy: string | null;
  lockedAt: string | null;
}

interface Variable {
  processInstanceId: string;
  processDef: string;
  name: string;
  type: string;
  value: unknown;
  updatedAt: string | null;
}

interface Page<T> {
  total: number;
  limit: number;
  offset: number;
  items: T[];
}

const STATUSES = ['', 'active', 'completed', 'error', 'aborted'];
const PAGE_SIZE = 200;
const REFRESH_MS = 5000;

export class ProcessInstancesView extends HTMLElement {
  private shadow: ShadowRoot;
  private galaxyUrl = '';
  private deploymentId = '';
  private status = '';
  private instances: ProcessInstance[] = [];
  private total = 0;
  private selectedId: string | null = null;
  private refreshTimer: number | null = null;
  private loading = false;

  private list!: HTMLElement;
  private summary!: HTMLElement;
  private error!: HTMLElement;
  private details!: HTMLElement;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.render();
  }

  /** Starts showing (and periodically refreshing) `deploymentId`'s instances. */
  open(galaxyUrl: string, deploymentId: string): void {
    this.galaxyUrl = galaxyUrl.replace(/\/$/, '');
    this.deploymentId = deploymentId;
    this.shadow.querySelector('.title')!.textContent = deploymentId;
    void this.refresh();
    this.stop();
    this.refreshTimer = window.setInterval(() => {
      if (!document.hidden) void this.refresh();
    }, REFRESH_MS);
  }

  stop(): void {
    if (this.refreshTimer !== null) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async refresh(): Promise<void> {
    if (this.loading || !this.galaxyUrl) return;
    this.loading = true;
    try {
      const params = new URLSearchParams({ deploymentId: this.deploymentId, limit: String(PAGE_SIZE) });
      if (this.status) params.set('status', this.status);
      const page = await this.fetchJson<Page<ProcessInstance>>(`/galaxy/process-instances?${params}`);
      this.instances = page.items;
      this.total = page.total;
      this.showError(null);
      this.renderList();
      if (this.selectedId) {
        await this.loadDetails(this.selectedId);
      }
    } catch (error) {
      this.showError(error instanceof Error ? error.message : String(error));
    } finally {
      this.loading = false;
    }
  }

  private async fetchJson<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.galaxyUrl}${path}`);
    } catch {
      throw new Error(`Cannot reach Galaxy at ${this.galaxyUrl}`);
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.message || `Galaxy answered HTTP ${response.status}`);
    }
    return body as T;
  }

  private renderList(): void {
    const rows = this.instances.map((instance) => {
      const row = document.createElement('tr');
      row.dataset.id = instance.id;
      row.tabIndex = 0;
      row.className = instance.id === this.selectedId ? 'selected' : '';

      const id = document.createElement('td');
      id.className = 'mono';
      id.textContent = shortId(instance.id);
      id.title = instance.id;

      const def = document.createElement('td');
      def.textContent = instance.processDef;

      const status = document.createElement('td');
      status.appendChild(statusBadge(instance.status));

      const lock = document.createElement('td');
      lock.className = 'muted';
      lock.textContent = instance.lockedBy ? 'running' : '';
      lock.title = instance.lockedBy ? `locked by ${instance.lockedBy} since ${formatDate(instance.lockedAt)}` : '';

      row.append(id, def, status, lock);
      return row;
    });

    if (rows.length === 0) {
      const empty = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 4;
      cell.className = 'empty';
      cell.textContent = this.status ? `No ${this.status} process instances.` : 'No process instances yet.';
      empty.appendChild(cell);
      rows.push(empty);
    }
    this.list.replaceChildren(...rows);
    this.summary.textContent = this.total > this.instances.length
      ? `${this.instances.length} of ${this.total}`
      : `${this.total} instance${this.total === 1 ? '' : 's'}`;

    // the selected instance fell out of the (filtered) list
    if (this.selectedId && !this.instances.some((instance) => instance.id === this.selectedId)) {
      this.selectedId = null;
      this.renderDetails(null, []);
    }
  }

  private async select(id: string): Promise<void> {
    this.selectedId = id;
    this.list.querySelectorAll('tr').forEach((row) => row.classList.toggle('selected', row.dataset.id === id));
    this.details.classList.add('loading');
    await this.loadDetails(id);
  }

  private async loadDetails(id: string): Promise<void> {
    try {
      const params = new URLSearchParams({ processInstanceId: id, limit: '500' });
      const page = await this.fetchJson<Page<Variable>>(`/galaxy/variables?${params}`);
      if (this.selectedId !== id) return; // selection moved on meanwhile
      this.renderDetails(this.instances.find((instance) => instance.id === id) ?? null, page.items);
    } catch (error) {
      this.showError(error instanceof Error ? error.message : String(error));
    } finally {
      this.details.classList.remove('loading');
    }
  }

  private renderDetails(instance: ProcessInstance | null, variables: Variable[]): void {
    if (!instance) {
      const hint = document.createElement('div');
      hint.className = 'placeholder';
      hint.textContent = 'Select a process instance to see its details and variables.';
      this.details.replaceChildren(hint);
      return;
    }

    const heading = document.createElement('div');
    heading.className = 'detail-heading';
    const title = document.createElement('span');
    title.className = 'detail-title';
    title.textContent = instance.processDef;
    heading.append(title, statusBadge(instance.status));

    const info = document.createElement('dl');
    info.className = 'info';
    const field = (label: string, value: string, mono = false, copy = false) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      const text = document.createElement('span');
      text.textContent = value;
      if (mono) text.className = 'mono';
      dd.appendChild(text);
      if (copy) {
        const button = document.createElement('button');
        button.className = 'copy';
        button.textContent = 'Copy';
        button.title = `Copy ${label.toLowerCase()}`;
        button.addEventListener('click', async () => {
          await navigator.clipboard.writeText(value).catch(() => undefined);
          button.textContent = 'Copied';
          window.setTimeout(() => { button.textContent = 'Copy'; }, 1200);
        });
        dd.appendChild(button);
      }
      info.append(dt, dd);
    };
    field('Instance', instance.id, true, true);
    field('Deployment', instance.deploymentId);
    field('Process', instance.processDef);
    field('Status', `${instance.status} (${instance.statusCode})`);
    field('Executing', instance.lockedBy ? `${instance.lockedBy} since ${formatDate(instance.lockedAt)}` : 'no');

    const variablesTitle = document.createElement('div');
    variablesTitle.className = 'section-title';
    variablesTitle.textContent = `Variables (${variables.length})`;

    const content: HTMLElement[] = [heading, info, variablesTitle];
    if (variables.length === 0) {
      const none = document.createElement('div');
      none.className = 'muted small';
      none.textContent = 'No variables persisted for this instance.';
      content.push(none);
    } else {
      const table = document.createElement('table');
      table.className = 'variables';
      const head = document.createElement('thead');
      head.innerHTML = '<tr><th>Name</th><th>Type</th><th>Value</th></tr>';
      const body = document.createElement('tbody');
      for (const variable of variables) {
        const row = document.createElement('tr');
        const name = document.createElement('td');
        name.className = 'mono';
        name.textContent = variable.name;
        const type = document.createElement('td');
        type.className = 'muted';
        type.textContent = variable.type;
        const value = document.createElement('td');
        value.className = 'mono value';
        value.textContent = formatValue(variable.value);
        if (variable.updatedAt) value.title = `updated ${formatDate(variable.updatedAt)}`;
        row.append(name, type, value);
        body.appendChild(row);
      }
      table.append(head, body);
      content.push(table);
    }
    this.details.replaceChildren(...content);
  }

  private showError(message: string | null): void {
    this.error.textContent = message ?? '';
    this.error.hidden = !message;
  }

  private render(): void {
    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          font-family: var(--font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
          font-size: 13px;
          color: var(--text, #1f2340);
        }
        .toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-bottom: 1px solid var(--glass-divider, #e0e0e0);
        }
        .title { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .summary { color: var(--text-subtle, #8a8fab); font-size: 12px; margin-right: auto; white-space: nowrap; }
        select, button {
          font: inherit;
          font-size: 12px;
          color: inherit;
          padding: 3px 8px;
          background: var(--glass-control-bg, white);
          border: var(--glass-control-border, 1px solid #ddd);
          border-radius: 8px;
          cursor: pointer;
        }
        button:hover, select:hover { background: var(--glass-control-bg-hover, #f5f5f5); }
        .error {
          margin: 8px 10px 0;
          padding: 6px 10px;
          border-radius: 8px;
          background: rgba(255, 235, 238, 0.8);
          color: #c62828;
          font-size: 12px;
        }
        .content {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-wrap: wrap;
          overflow: auto;
        }
        .list-pane {
          flex: 1 1 340px;
          min-width: 0;
          overflow: auto;
          border-right: 1px solid var(--glass-divider, #e0e0e0);
        }
        .details {
          flex: 1 1 320px;
          min-width: 0;
          overflow: auto;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.3);
          transition: opacity 0.15s;
        }
        .details.loading { opacity: 0.6; }
        table { width: 100%; border-collapse: collapse; }
        th {
          position: sticky;
          top: 0;
          text-align: left;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted, #5b6080);
          padding: 6px 10px;
          background: rgba(248, 248, 255, 0.95);
          border-bottom: 1px solid var(--glass-divider, #e0e0e0);
        }
        td { padding: 6px 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.5); vertical-align: top; }
        .instances tbody tr { cursor: pointer; }
        .instances tbody tr:hover { background: rgba(255, 255, 255, 0.55); }
        .instances tbody tr:focus-visible { outline: 2px solid var(--accent, #5b5bf7); outline-offset: -2px; }
        .instances tbody tr.selected { background: rgba(91, 91, 247, 0.12); }
        .instances tbody tr.selected td:first-child { box-shadow: inset 3px 0 0 var(--accent, #5b5bf7); }
        .empty, .placeholder { color: var(--text-subtle, #8a8fab); font-style: italic; padding: 24px 10px; text-align: center; cursor: default; }
        .mono { font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace; font-size: 12px; }
        .muted { color: var(--text-muted, #5b6080); }
        .small { font-size: 12px; }
        .badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          padding: 1px 8px;
          border-radius: 10px;
          text-transform: capitalize;
        }
        .badge-active { background: rgba(62, 142, 247, 0.15); color: #1565c0; }
        .badge-completed { background: rgba(46, 170, 98, 0.15); color: #2e7d32; }
        .badge-error { background: rgba(229, 72, 77, 0.15); color: #c62828; }
        .badge-aborted { background: rgba(245, 165, 36, 0.18); color: #b26a00; }
        .detail-heading { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .detail-title { font-size: 15px; font-weight: 700; }
        .info {
          display: grid;
          grid-template-columns: max-content 1fr;
          gap: 4px 12px;
          margin: 0 0 14px;
        }
        dt { color: var(--text-muted, #5b6080); font-size: 12px; }
        dd { margin: 0; display: flex; align-items: center; gap: 6px; min-width: 0; word-break: break-all; }
        .copy { padding: 0 6px; font-size: 11px; }
        .section-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted, #5b6080);
          margin-bottom: 6px;
        }
        .variables { background: rgba(255, 255, 255, 0.45); border-radius: 10px; overflow: hidden; }
        .variables .value { white-space: pre-wrap; word-break: break-word; }
      </style>
      <div class="toolbar">
        <span class="title"></span>
        <span class="summary"></span>
        <select class="status-filter" title="Filter by status">
          ${STATUSES.map((status) => `<option value="${status}">${status || 'all statuses'}</option>`).join('')}
        </select>
        <button class="refresh" title="Refresh now">⟳</button>
      </div>
      <div class="error" hidden></div>
      <div class="content">
        <div class="list-pane">
          <table class="instances">
            <thead><tr><th>Instance</th><th>Process</th><th>Status</th><th></th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="details"></div>
      </div>
    `;

    this.list = this.shadow.querySelector('.instances tbody')!;
    this.summary = this.shadow.querySelector('.summary')!;
    this.error = this.shadow.querySelector('.error')!;
    this.details = this.shadow.querySelector('.details')!;
    this.renderDetails(null, []);

    const statusFilter = this.shadow.querySelector<HTMLSelectElement>('.status-filter')!;
    statusFilter.addEventListener('change', () => {
      this.status = statusFilter.value;
      void this.refresh();
    });
    this.shadow.querySelector('.refresh')!.addEventListener('click', () => void this.refresh());

    const pick = (event: Event) => {
      const row = (event.target as HTMLElement).closest<HTMLElement>('tr[data-id]');
      if (row?.dataset.id) void this.select(row.dataset.id);
    };
    this.list.addEventListener('click', pick);
    this.list.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        pick(event);
      }
    });
  }
}

function statusBadge(status: string): HTMLElement {
  const badge = document.createElement('span');
  badge.className = `badge badge-${status}`;
  badge.textContent = status;
  return badge;
}

function shortId(id: string): string {
  return id.length > 13 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function formatDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '∅';
  if (typeof value === 'string') return JSON.stringify(value);
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
}

customElements.define('andromeda-process-instances', ProcessInstancesView);
