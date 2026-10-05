/**
 * Live log view of one engine/container process: an EventSource on its
 * GET /api/logs/stream (Server-Sent Events, see the engine's
 * src/modules/web/log-stream.routes.js). Opened from the Galaxy panel's
 * "Logs" button into a dock panel (see Workspace.openLogs).
 *
 * The server replays its recent backlog on connect; a dropped connection is
 * retried by EventSource itself with Last-Event-ID, so nothing is lost or
 * duplicated across reconnects. Log text is untrusted - it's only ever set
 * through textContent.
 */

export interface LogEvent {
  id: number;
  level: string;
  levelValue: number;
  time?: string;
  name?: string;
  msg?: string;
  [key: string]: unknown;
}

const LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
const LEVEL_VALUES: Record<string, number> = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };
// fields shown in their own columns; everything else goes in the row tooltip
const STANDARD_FIELDS = new Set(['id', 'level', 'levelValue', 'time', 'name', 'msg', 'pid', 'hostname', 'application', 'ENV', 'ip']);
// keep the browser responsive on chatty processes
const MAX_EVENTS = 2000;
// new events are rendered in small batches rather than one DOM update each
const RENDER_BATCH_MS = 100;

export class LogViewer extends HTMLElement {
  private shadow: ShadowRoot;
  private source: EventSource | null = null;
  private events: LogEvent[] = [];
  private pending: LogEvent[] = [];
  private renderTimer: number | null = null;
  private minLevel = LEVEL_VALUES.debug;
  private search = '';
  private paused = false;
  private list!: HTMLElement;
  private status!: HTMLElement;
  private counter!: HTMLElement;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.render();
  }

  /** Starts streaming from `url` (an /api/logs/stream endpoint). */
  connect(url: string): void {
    this.disconnect();
    this.setStatus('connecting', 'Connecting…');
    const source = new EventSource(url);
    this.source = source;

    source.onopen = () => this.setStatus('live', 'Live');
    source.onerror = () => {
      // EventSource retries by itself unless the server answered with a hard failure
      if (source.readyState === EventSource.CLOSED) {
        this.setStatus('closed', 'Disconnected');
      } else {
        this.setStatus('connecting', 'Reconnecting…');
      }
    };
    source.addEventListener('log', (event) => {
      try {
        this.receive(JSON.parse((event as MessageEvent).data));
      } catch {
        // malformed frame - skip it
      }
    });
  }

  disconnect(): void {
    this.source?.close();
    this.source = null;
    if (this.renderTimer !== null) {
      window.clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
  }

  private receive(event: LogEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }
    if (this.paused) {
      this.updateCounter();
      return;
    }
    this.pending.push(event);
    if (this.renderTimer === null) {
      this.renderTimer = window.setTimeout(() => this.flush(), RENDER_BATCH_MS);
    }
  }

  private flush(): void {
    this.renderTimer = null;
    const stick = this.isScrolledToBottom();
    const fragment = document.createDocumentFragment();
    for (const event of this.pending) {
      if (this.isShown(event)) fragment.appendChild(this.row(event));
    }
    this.pending = [];
    this.list.appendChild(fragment);
    // drop rows beyond the buffer from the DOM too
    while (this.list.childElementCount > MAX_EVENTS) {
      this.list.firstElementChild?.remove();
    }
    this.updateCounter();
    if (stick) this.scrollToBottom();
  }

  /** Re-renders everything from the buffer (filter changed, resumed, cleared). */
  private rerender(): void {
    this.pending = [];
    const fragment = document.createDocumentFragment();
    for (const event of this.events) {
      if (this.isShown(event)) fragment.appendChild(this.row(event));
    }
    this.list.replaceChildren(fragment);
    this.updateCounter();
    this.scrollToBottom();
  }

  private isShown(event: LogEvent): boolean {
    if ((event.levelValue ?? LEVEL_VALUES.info) < this.minLevel) return false;
    if (!this.search) return true;
    const haystack = `${event.msg ?? ''} ${event.name ?? ''}`.toLowerCase();
    return haystack.includes(this.search);
  }

  private row(event: LogEvent): HTMLElement {
    const row = document.createElement('div');
    row.className = `row level-${event.level}`;

    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = formatTime(event.time);

    const level = document.createElement('span');
    level.className = 'level';
    level.textContent = String(event.level).toUpperCase();

    const msg = document.createElement('span');
    msg.className = 'msg';
    msg.textContent = event.msg ?? '';

    row.append(time, level, msg);

    const extra = Object.fromEntries(Object.entries(event).filter(([key]) => !STANDARD_FIELDS.has(key)));
    if (Object.keys(extra).length > 0) {
      const details = document.createElement('span');
      details.className = 'extra';
      details.textContent = JSON.stringify(extra);
      row.appendChild(details);
    }
    row.title = `${event.name ?? ''} #${event.id}`;
    return row;
  }

  private isScrolledToBottom(): boolean {
    const body = this.list.parentElement!;
    return body.scrollHeight - body.scrollTop - body.clientHeight < 40;
  }

  private scrollToBottom(): void {
    const body = this.list.parentElement!;
    body.scrollTop = body.scrollHeight;
  }

  private setStatus(state: 'connecting' | 'live' | 'closed', text: string): void {
    this.status.className = `status status-${state}`;
    this.status.textContent = text;
  }

  private updateCounter(): void {
    const hidden = this.paused ? ' (paused)' : '';
    this.counter.textContent = `${this.list.childElementCount} / ${this.events.length}${hidden}`;
  }

  private render(): void {
    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          font-family: var(--font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
          color: var(--text, #1f2340);
        }
        .toolbar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-bottom: 1px solid var(--glass-divider, #e0e0e0);
          font-size: 12px;
        }
        .status {
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.5);
        }
        .status::before { content: '● '; }
        .status-live { color: #2e7d32; }
        .status-connecting { color: #b26a00; }
        .status-closed { color: #c62828; }
        .counter { color: var(--text-subtle, #8a8fab); margin-right: auto; }
        select, input, button {
          font: inherit;
          font-size: 12px;
          color: inherit;
          padding: 3px 8px;
          background: var(--glass-control-bg, white);
          border: var(--glass-control-border, 1px solid #ddd);
          border-radius: 8px;
        }
        input { width: 140px; }
        button { cursor: pointer; }
        button:hover, select:hover { background: var(--glass-control-bg-hover, #f5f5f5); }
        button[aria-pressed="true"] { color: var(--accent, #5b5bf7); border-color: var(--accent, #5b5bf7); }
        .body {
          flex: 1;
          overflow: auto;
          background: rgba(255, 255, 255, 0.35);
        }
        .list {
          font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
          font-size: 12px;
          line-height: 1.5;
          padding: 4px 0;
        }
        .row {
          display: flex;
          gap: 10px;
          padding: 0 10px;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .row:hover { background: rgba(255, 255, 255, 0.6); }
        .time { flex: 0 0 auto; color: var(--text-subtle, #8a8fab); }
        .level { flex: 0 0 44px; font-weight: 700; }
        .msg { flex: 0 1 auto; }
        .extra { color: var(--text-subtle, #8a8fab); }
        .level-trace .level { color: #9aa0b8; }
        .level-debug .level { color: #607d8b; }
        .level-info .level { color: #1565c0; }
        .level-warn .level { color: #b26a00; }
        .level-warn { background: rgba(255, 193, 7, 0.08); }
        .level-error .level, .level-fatal .level { color: #c62828; }
        .level-error, .level-fatal { background: rgba(244, 67, 54, 0.08); }
      </style>
      <div class="toolbar">
        <span class="status status-connecting">Connecting…</span>
        <span class="counter"></span>
        <select class="level-filter" title="Minimum level">
          ${LEVELS.map((level) => `<option value="${level}">${level}</option>`).join('')}
        </select>
        <input class="search" type="search" placeholder="Filter…" title="Show lines containing this text">
        <button class="pause" aria-pressed="false" title="Pause / resume the view">Pause</button>
        <button class="clear" title="Clear the view">Clear</button>
      </div>
      <div class="body"><div class="list"></div></div>
    `;

    this.list = this.shadow.querySelector('.list')!;
    this.status = this.shadow.querySelector('.status')!;
    this.counter = this.shadow.querySelector('.counter')!;

    const levelFilter = this.shadow.querySelector<HTMLSelectElement>('.level-filter')!;
    levelFilter.value = 'debug';
    levelFilter.addEventListener('change', () => {
      this.minLevel = LEVEL_VALUES[levelFilter.value];
      this.rerender();
    });

    const search = this.shadow.querySelector<HTMLInputElement>('.search')!;
    search.addEventListener('input', () => {
      this.search = search.value.trim().toLowerCase();
      this.rerender();
    });

    const pause = this.shadow.querySelector<HTMLButtonElement>('.pause')!;
    pause.addEventListener('click', () => {
      this.paused = !this.paused;
      pause.textContent = this.paused ? 'Resume' : 'Pause';
      pause.setAttribute('aria-pressed', String(this.paused));
      if (!this.paused) this.rerender();
      else this.updateCounter();
    });

    this.shadow.querySelector('.clear')!.addEventListener('click', () => {
      this.events = [];
      this.rerender();
    });
  }
}

function formatTime(time: string | undefined): string {
  if (!time) return '';
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return String(time);
  return date.toLocaleTimeString(undefined, { hour12: false }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
}

customElements.define('andromeda-log-viewer', LogViewer);
