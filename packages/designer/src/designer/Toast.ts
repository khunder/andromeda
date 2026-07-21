/**
 * Lightweight toast notifications, replacing blocking alert() calls across the designer.
 */

export type ToastType = 'success' | 'error' | 'info';

const CONTAINER_ID = 'andromeda-toast-container';
const STYLE_ID = 'andromeda-toast-styles';
const DEFAULT_DURATION_MS = 4000;

function ensureContainer(): HTMLElement {
  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = CONTAINER_ID;
    document.body.appendChild(container);
  }

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${CONTAINER_ID} {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 10050;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 360px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }

      .andromeda-toast {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 6px;
        border: 1px solid transparent;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-size: 13px;
        line-height: 1.4;
        animation: andromeda-toast-in 0.15s ease-out;
      }

      .andromeda-toast-hide {
        animation: andromeda-toast-out 0.15s ease-in forwards;
      }

      @keyframes andromeda-toast-in {
        from { transform: translateX(16px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }

      @keyframes andromeda-toast-out {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(16px); opacity: 0; }
      }

      .andromeda-toast-message {
        flex: 1;
        word-break: break-word;
      }

      .andromeda-toast-close {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 0;
        color: inherit;
        opacity: 0.6;
      }

      .andromeda-toast-close:hover {
        opacity: 1;
      }

      .andromeda-toast-success {
        background: #e8f5e9;
        border-color: #a5d6a7;
        color: #2e7d32;
      }

      .andromeda-toast-error {
        background: #ffebee;
        border-color: #f3c0c0;
        color: #c62828;
      }

      .andromeda-toast-info {
        background: #e3f2fd;
        border-color: #bbdefb;
        color: #1565c0;
      }
    `;
    document.head.appendChild(style);
  }

  return container;
}

export function showToast(message: string, type: ToastType = 'info', durationMs: number = DEFAULT_DURATION_MS): void {
  const container = ensureContainer();

  const toast = document.createElement('div');
  toast.className = `andromeda-toast andromeda-toast-${type}`;

  const messageSpan = document.createElement('span');
  messageSpan.className = 'andromeda-toast-message';
  messageSpan.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'andromeda-toast-close';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.textContent = '×';

  toast.appendChild(messageSpan);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    toast.classList.add('andromeda-toast-hide');
    setTimeout(() => toast.remove(), 150);
  };

  closeBtn.addEventListener('click', dismiss);
  setTimeout(dismiss, durationMs);
}
