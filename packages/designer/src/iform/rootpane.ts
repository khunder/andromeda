import type { RootPane } from './types';

/** The default root pane: fields go straight into an element. */
export class ElementRootPane implements RootPane {
  constructor(readonly element: HTMLElement) {}

  append(node: HTMLElement): void {
    this.element.appendChild(node);
  }

  clear(): void {
    this.element.replaceChildren();
  }
}

/** A host element, or a pane a host application provides. */
export function toRootPane(host: HTMLElement | RootPane): RootPane {
  const pane = host as RootPane;
  return typeof pane.clear === 'function' && pane.element ? pane : new ElementRootPane(host as HTMLElement);
}
