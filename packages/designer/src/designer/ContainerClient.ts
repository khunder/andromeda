/**
 * Calls to a container's REST API (http://host:port) with the designer's
 * OIDC access token, plus completing a human task from its iform form -
 * shared by the Tasks worklist (TasksView) and the instance viewer.
 */
import { iform, isPickedFile, type IForm, type IFormDefinition, type IFormFileValue } from '../iform';

/** GET /{processDef}/tasks/:processInstanceId/:nodeId */
export interface TaskDetail {
  processInstanceId: string;
  nodeId: string;
  nodeName: string;
  roles: string[];
  editableVariables: string[];
  form: IFormDefinition | null;
  variables: Record<string, unknown>;
}

/** POST /{processDef}/signal */
export interface SignalResult {
  resumed: boolean;
  processInstanceId?: string;
  nodeId?: string;
  warnings?: string[];
}

export type SignalFiles = Record<string, Omit<IFormFileValue, 'size'>>;

export class ContainerClient {
  constructor(
    readonly host: string,
    readonly port: string | number,
    /** read on every request - the token can change */
    private readonly authHeaders: () => Record<string, string> = () => ({}),
  ) {}

  get base(): string {
    return `http://${this.host}:${this.port}`;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.base}${path}`, {
        ...init,
        headers: { ...(init.headers || {}), ...this.authHeaders() },
      });
    } catch {
      throw new Error(`Cannot reach the container at ${this.base}`);
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const hint = response.status === 401
        ? ' - set an OIDC access token in the settings panel (click the canvas background)'
        : '';
      throw new Error(`${body?.message || `HTTP ${response.status}`}${hint}`);
    }
    return body as T;
  }

  taskDetail(processDef: string, processInstanceId: string, nodeId: string): Promise<TaskDetail> {
    return this.request<TaskDetail>(`/${processDef}/tasks/${encodeURIComponent(processInstanceId)}/${encodeURIComponent(nodeId)}`);
  }

  /** Resumes an instance waiting at a human task or catch event. */
  signal(processDef: string, body: { processInstanceId: string; nodeId: string; variables?: Record<string, unknown>; formData?: Record<string, unknown>; files?: SignalFiles }): Promise<SignalResult> {
    return this.request<SignalResult>(`/${processDef}/signal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
}

/** The form a task shows: its own, or - without one - fields for the variables it may change, typed by their current value. */
export function taskFormDefinition(detail: TaskDetail): IFormDefinition {
  if (detail.form && Array.isArray(detail.form.components)) return detail.form;
  return iform.generateForm(detail.editableVariables.map((name) => {
    const value = detail.variables[name];
    const type = typeof value === 'boolean' ? 'boolean'
      : typeof value === 'number' ? 'number'
        : value && typeof value === 'object' ? 'object'
          : 'string';
    return { name, type };
  }));
}

/** A file variable's stored value: a reference ({ kind: 'file', key, sha256... }), not content. */
function isStoredFile(value: unknown): boolean {
  return !!value && typeof value === 'object' && (value as { kind?: unknown }).kind === 'file';
}

/**
 * The signal body parts of a submitted task form: only what the task may
 * change (read-only fields are part of the form data too); a newly picked
 * file goes as `files`, a stored file variable left as it is isn't sent.
 */
export function signalPayloadFromForm(form: IForm, data: Record<string, unknown>, editableVariables: string[]): { formData: Record<string, unknown>; files: SignalFiles } {
  const editable = new Set(form.editableKeys().filter((key) => editableVariables.includes(key)));
  const files: SignalFiles = {};
  const formData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!editable.has(key)) continue;
    if (isPickedFile(value)) {
      files[key] = { base64: value.base64, fileName: value.fileName, contentType: value.contentType };
    } else if (!isStoredFile(value)) {
      formData[key] = value;
    }
  }
  return { formData, files };
}
