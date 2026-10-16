/**
 * Human task worklist of one container: the pending tasks the caller may
 * complete (GET /{processDef}/tasks), and the selected task's form (iform),
 * prefilled with the instance's variables (GET /{processDef}/tasks/{id}/{node}).
 *
 * Accept submits the form to POST /{processDef}/signal as `formData` (fields
 * named like a process variable the task may change set it) and the process
 * continues; Close only dismisses the form - nothing is sent, the task stays
 * pending. Requests carry the designer's OIDC access token when one is set.
 *
 * Rendered in the light DOM, styled under .tasks-view; the form's fields use
 * the application's own styles (see src/iform/iform.config.ts).
 */
import { iform, IFormValidationError, type IForm } from '../iform';
import { ContainerClient, signalPayloadFromForm, taskFormDefinition, type TaskDetail } from './ContainerClient';
import { showToast } from './Toast';

interface PendingTask {
  processDef: string;
  processInstanceId: string;
  nodeId: string;
  nodeName: string;
  roles: string[];
  hasForm: boolean;
}

export interface TasksViewOptions {
  host: string;
  port: string;
  deploymentId: string;
  processDefs: string[];
  /** Authorization header, read on every request (the token can change) */
  authHeaders: () => Record<string, string>;
}

const REFRESH_MS = 10_000;

export class TasksView extends HTMLElement {
  private options!: TasksViewOptions;
  private client!: ContainerClient;
  private tasks: PendingTask[] = [];
  private selected: PendingTask | null = null;
  private form: IForm | null = null;
  private refreshTimer: number | null = null;
  private listEl!: HTMLElement;
  private formEl!: HTMLElement;
  private whoEl!: HTMLElement;
  private errorEl!: HTMLElement;

  connectedCallback(): void {
    this.ensureRendered();
  }

  // built on first use - dockview calls open() before the element is attached,
  // and moves it around afterwards (connectedCallback runs again)
  private ensureRendered(): void {
    if (this.listEl) return;
    this.className = 'tasks-view';
    this.innerHTML = `
      <div class="tasks-toolbar">
        <span class="tasks-title"></span>
        <span class="tasks-who" title="Who the container sees you as (GET /api/auth/me)"></span>
        <button class="tasks-refresh" title="Refresh">⟳</button>
      </div>
      <div class="tasks-error" hidden></div>
      <div class="tasks-content">
        <ul class="tasks-list" aria-label="Pending human tasks"></ul>
        <div class="tasks-form"></div>
      </div>
    `;
    this.listEl = this.querySelector('.tasks-list')!;
    this.formEl = this.querySelector('.tasks-form')!;
    this.whoEl = this.querySelector('.tasks-who')!;
    this.errorEl = this.querySelector('.tasks-error')!;
    this.querySelector('.tasks-refresh')!.addEventListener('click', () => void this.refresh());
    this.listEl.addEventListener('click', (event) => {
      const item = (event.target as HTMLElement).closest<HTMLElement>('[data-index]');
      if (item) void this.select(this.tasks[Number(item.dataset.index)]);
    });
    this.listEl.addEventListener('keydown', (event) => {
      const item = (event.target as HTMLElement).closest<HTMLElement>('[data-index]');
      if (item && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        void this.select(this.tasks[Number(item.dataset.index)]);
      }
    });
    this.showPlaceholder();
  }

  open(options: TasksViewOptions): void {
    this.ensureRendered();
    this.options = options;
    this.client = new ContainerClient(options.host, options.port, options.authHeaders);
    (this.querySelector('.tasks-title') as HTMLElement).textContent = options.deploymentId;
    void this.whoAmI();
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

  private request<T>(path: string, init: RequestInit = {}): Promise<T> {
    return this.client.request<T>(path, init);
  }

  private async whoAmI(): Promise<void> {
    try {
      const me = await this.request<{ oidcEnabled: boolean; anonymous: boolean; name: string | null; subject: string | null; roles: string[]; adminRole: string }>('/api/auth/me');
      this.whoEl.textContent = me.oidcEnabled
        ? `${me.name || me.subject} · ${me.roles.join(', ') || 'no roles'}`
        : `OIDC off - acting as ${me.adminRole}`;
      this.whoEl.classList.remove('tasks-who-error');
    } catch (error) {
      this.whoEl.textContent = error instanceof Error && /401|token/i.test(error.message) ? 'not signed in' : 'unknown user';
      this.whoEl.classList.add('tasks-who-error');
    }
  }

  private async refresh(): Promise<void> {
    if (!this.options) return;
    try {
      const lists = await Promise.all(this.options.processDefs.map(async (processDef) => {
        const tasks = await this.request<Omit<PendingTask, 'processDef'>[]>(`/${processDef}/tasks`);
        return tasks.map((task) => ({ ...task, processDef }));
      }));
      this.tasks = lists.flat();
      this.showError(null);
    } catch (error) {
      this.tasks = [];
      this.showError(error instanceof Error ? error.message : String(error));
    }
    this.renderList();
    // the task was completed (e.g. by someone else) - close its form
    if (this.selected && !this.tasks.some((task) => this.sameTask(task, this.selected!))) {
      this.closeForm();
    }
  }

  private sameTask(a: PendingTask, b: PendingTask): boolean {
    return a.processInstanceId === b.processInstanceId && a.nodeId === b.nodeId;
  }

  private renderList(): void {
    const items = this.tasks.map((task, index) => {
      const item = document.createElement('li');
      item.dataset.index = String(index);
      item.tabIndex = 0;
      item.className = this.selected && this.sameTask(task, this.selected) ? 'selected' : '';
      const name = document.createElement('div');
      name.className = 'task-name';
      name.textContent = task.nodeName;
      const meta = document.createElement('div');
      meta.className = 'task-meta';
      meta.textContent = `${task.processDef} · ${task.processInstanceId.slice(0, 8)}…${task.roles.length ? ` · ${task.roles.join(', ')}` : ''}`;
      meta.title = task.processInstanceId;
      item.append(name, meta);
      return item;
    });
    if (items.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'tasks-empty';
      empty.textContent = 'No pending tasks you can complete.';
      items.push(empty);
    }
    this.listEl.replaceChildren(...items);
  }

  private async select(task: PendingTask | undefined): Promise<void> {
    if (!task) return;
    this.selected = task;
    this.renderList();
    let detail: TaskDetail;
    try {
      detail = await this.client.taskDetail(task.processDef, task.processInstanceId, task.nodeId);
    } catch (error) {
      this.showError(error instanceof Error ? error.message : String(error));
      return;
    }
    await this.renderForm(task, detail);
  }

  private async renderForm(task: PendingTask, detail: TaskDetail): Promise<void> {
    this.destroyForm();

    const header = document.createElement('div');
    header.className = 'task-form-header';
    const title = document.createElement('h3');
    title.textContent = detail.nodeName;
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.textContent = `${task.processDef} · instance ${detail.processInstanceId} · may change: ${detail.editableVariables.join(', ') || 'nothing'}`;
    header.append(title, meta);

    const formHost = document.createElement('div');
    formHost.className = 'task-form-body';

    const actions = document.createElement('div');
    actions.className = 'task-form-actions';
    const close = document.createElement('button');
    close.className = 'task-btn';
    close.textContent = 'Close';
    close.title = 'Dismiss the form - nothing is sent, the task stays pending';
    const accept = document.createElement('button');
    accept.className = 'task-btn task-btn-primary';
    accept.textContent = 'Accept';
    accept.title = 'Submit the form - the process continues';
    actions.append(close, accept);

    this.formEl.replaceChildren(header, formHost, actions);

    // file fields show a stored file variable by name and keep it unless a new file is picked
    this.form = iform.create(formHost, taskFormDefinition(detail), { data: detail.variables });

    close.addEventListener('click', () => this.closeForm());
    accept.addEventListener('click', () => void this.accept(task, detail, accept));
  }

  private async accept(task: PendingTask, detail: TaskDetail, button: HTMLButtonElement): Promise<void> {
    if (!this.form) return;
    button.disabled = true;
    try {
      let data;
      try {
        data = await this.form.submit();
      } catch (error) {
        showToast(error instanceof IFormValidationError ? 'Please fix the highlighted fields' : String(error), 'error');
        return;
      }
      const { formData, files } = signalPayloadFromForm(this.form, data, detail.editableVariables);
      const result = await this.client.signal(task.processDef, {
        processInstanceId: task.processInstanceId,
        nodeId: task.nodeId,
        formData,
        ...(Object.keys(files).length > 0 ? { files } : {}),
      });
      if (result.warnings?.length) {
        showToast(`${task.nodeName} accepted - ${result.warnings.join('; ')}`, 'warning');
      } else {
        showToast(`${task.nodeName} accepted - the process continues`, 'success');
      }
      this.closeForm();
      await this.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      button.disabled = false;
    }
  }

  private closeForm(): void {
    this.selected = null;
    this.destroyForm();
    this.showPlaceholder();
    this.renderList();
  }

  private destroyForm(): void {
    this.form?.destroy();
    this.form = null;
  }

  private showPlaceholder(): void {
    const hint = document.createElement('div');
    hint.className = 'tasks-placeholder';
    hint.textContent = 'Select a task to open its form.';
    this.formEl.replaceChildren(hint);
  }

  private showError(message: string | null): void {
    this.errorEl.textContent = message ?? '';
    this.errorEl.hidden = !message;
  }
}

customElements.define('andromeda-tasks', TasksView);
