/**
 * Toast notifications (bottom-right), replacing blocking alert() calls across
 * the designer.
 *
 * - a progress bar shows the time left; hovering a toast pauses it
 * - the same message shown again while still visible bumps a "×n" counter
 *   and restarts the timer instead of stacking duplicates
 * - at most MAX_VISIBLE toasts, the oldest make room for new ones
 * - durationMs 0 keeps a toast until it's closed
 *
 * The countdown is the progress bar's CSS animation itself (dismissed on
 * `animationend`), so pausing on hover is just `animation-play-state`.
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

const CONTAINER_ID = 'andromeda-toast-container';
const STYLE_ID = 'andromeda-toast-styles';
const DEFAULT_DURATION_MS = 4000;
// errors usually need reading (and often copying) - give them longer
const DEFAULT_ERROR_DURATION_MS = 8000;
const MAX_VISIBLE = 4;
const EXIT_MS = 200;

const TITLES: Record<ToastType, string> = {
  success: 'Success',
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
};

// 20x20 stroke icons, currentColor
const ICONS: Record<ToastType, string> = {
  success: '<circle cx="12" cy="12" r="9"/><polyline points="8 12.5 11 15.5 16 9.5"/>',
  error: '<circle cx="12" cy="12" r="9"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>',
  warning: '<path d="M12 3.5 21.5 20h-19z"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="17" r="0.6"/>',
  info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r="0.6"/>',
};

interface ActiveToast {
  element: HTMLElement;
  key: string;
  count: number;
  dismiss: () => void;
  restart: () => void;
}

const active: ActiveToast[] = [];

function ensureContainer(): HTMLElement {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message: string, type: ToastType = 'info', durationMs?: number): void {
  const duration = durationMs ?? (type === 'error' ? DEFAULT_ERROR_DURATION_MS : DEFAULT_DURATION_MS);
  const container = ensureContainer();

  const key = `${type}\u0000${message}`;
  const existing = active.find((toast) => toast.key === key);
  if (existing) {
    existing.count += 1;
    const badge = existing.element.querySelector('.andromeda-toast-count')!;
    badge.textContent = `×${existing.count}`;
    badge.classList.remove('andromeda-toast-count-bump');
    void (badge as HTMLElement).offsetWidth; // restart the bump animation
    badge.classList.add('andromeda-toast-count-bump');
    existing.restart();
    return;
  }

  const toast = document.createElement('div');
  toast.className = `andromeda-toast andromeda-toast-${type}`;
  // errors interrupt a screen reader, the rest wait their turn
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', 'andromeda-toast-icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = ICONS[type];

  const body = document.createElement('div');
  body.className = 'andromeda-toast-body';

  const title = document.createElement('div');
  title.className = 'andromeda-toast-title';
  title.textContent = TITLES[type];

  const count = document.createElement('span');
  count.className = 'andromeda-toast-count';
  title.appendChild(count);

  const text = document.createElement('div');
  text.className = 'andromeda-toast-message';
  // messages can carry server responses - plain text only
  text.textContent = message;

  body.append(title, text);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'andromeda-toast-close';
  closeBtn.setAttribute('aria-label', 'Dismiss notification');
  closeBtn.textContent = '×';

  const progress = document.createElement('div');
  progress.className = 'andromeda-toast-progress';

  toast.append(icon, body, closeBtn, progress);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    const index = active.indexOf(entry);
    if (index >= 0) active.splice(index, 1);
    toast.classList.add('andromeda-toast-hide');
    window.setTimeout(() => toast.remove(), EXIT_MS);
  };

  const restart = () => {
    if (duration <= 0) return;
    // only the name: resetting the `animation` shorthand would also wipe the
    // inline duration and end the countdown at once
    progress.style.animationName = 'none';
    void progress.offsetWidth; // reflow so the animation starts over
    progress.style.animationName = '';
  };

  if (duration > 0) {
    progress.style.animationDuration = `${duration}ms`;
    progress.addEventListener('animationend', dismiss);
  } else {
    progress.remove(); // sticky - stays until closed
  }
  closeBtn.addEventListener('click', dismiss);

  const entry: ActiveToast = { element: toast, key, count: 1, dismiss, restart };
  active.push(entry);
  container.appendChild(toast);

  // make room - oldest first
  while (active.length > MAX_VISIBLE) {
    active[0].dismiss();
  }
}

const STYLES = `
  #${CONTAINER_ID} {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 10050;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
    width: min(380px, calc(100vw - 40px));
    pointer-events: none;
    font-family: var(--font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
  }

  .andromeda-toast {
    --toast-accent: #5b5bf7;
    position: relative;
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 14px 16px 16px;
    overflow: hidden;
    pointer-events: auto;
    color: var(--text, #1f2340);
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(19px);
    -webkit-backdrop-filter: blur(19px);
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 16px;
    box-shadow:
      0 12px 32px rgba(31, 35, 64, 0.16),
      0 2px 6px rgba(31, 35, 64, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
    animation: andromeda-toast-in 0.28s cubic-bezier(0.21, 1.02, 0.73, 1) both;
  }

  /* coloured edge */
  .andromeda-toast::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--toast-accent);
  }

  .andromeda-toast-success { --toast-accent: #2eaa62; }
  .andromeda-toast-error { --toast-accent: #e5484d; }
  .andromeda-toast-warning { --toast-accent: #f5a524; }
  .andromeda-toast-info { --toast-accent: #3e8ef7; }

  .andromeda-toast-icon {
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    margin-top: 1px;
    fill: none;
    stroke: var(--toast-accent);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .andromeda-toast-body {
    flex: 1;
    min-width: 0;
  }

  .andromeda-toast-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 2px;
  }

  .andromeda-toast-count:empty {
    display: none;
  }

  .andromeda-toast-count {
    font-size: 11px;
    font-weight: 700;
    padding: 0 6px;
    border-radius: 8px;
    color: white;
    background: var(--toast-accent);
  }

  .andromeda-toast-count-bump {
    animation: andromeda-toast-bump 0.3s ease-out;
  }

  .andromeda-toast-message {
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-muted, #5b6080);
    word-break: break-word;
    /* long server errors: scroll inside the toast instead of filling the screen */
    max-height: 9em;
    overflow-y: auto;
    user-select: text;
  }

  .andromeda-toast-close {
    flex: 0 0 auto;
    width: 24px;
    height: 24px;
    margin: -4px -4px 0 0;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-subtle, #8a8fab);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .andromeda-toast-close:hover {
    background: rgba(31, 35, 64, 0.08);
    color: var(--text, #1f2340);
  }

  .andromeda-toast-close:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(91, 91, 247, 0.3);
  }

  /* time left - its animation ending is what dismisses the toast */
  .andromeda-toast-progress {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 3px;
    width: 100%;
    background: var(--toast-accent);
    opacity: 0.55;
    transform-origin: left;
    animation-name: andromeda-toast-countdown;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
  }

  .andromeda-toast:hover .andromeda-toast-progress,
  .andromeda-toast:focus-within .andromeda-toast-progress {
    animation-play-state: paused;
  }

  .andromeda-toast-hide {
    animation: andromeda-toast-out ${EXIT_MS}ms ease-in forwards;
  }

  @keyframes andromeda-toast-in {
    from { transform: translateY(16px) scale(0.96); opacity: 0; }
    to { transform: none; opacity: 1; }
  }

  @keyframes andromeda-toast-out {
    from { transform: none; opacity: 1; }
    to { transform: translateX(24px); opacity: 0; }
  }

  @keyframes andromeda-toast-countdown {
    from { transform: scaleX(1); }
    to { transform: scaleX(0); }
  }

  @keyframes andromeda-toast-bump {
    50% { transform: scale(1.25); }
  }

  @media (prefers-reduced-motion: reduce) {
    .andromeda-toast,
    .andromeda-toast-hide,
    .andromeda-toast-count-bump {
      animation-duration: 1ms;
    }
  }
`;
