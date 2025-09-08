import { Point } from './types';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  action: () => void;
  divider?: boolean;
}

export class ContextMenu {
  private container: HTMLDivElement;
  private isVisible = false;

  constructor() {
    this.container = this.createContainer();
    document.body.appendChild(this.container);
    
    // Hide on click outside - use mousedown to catch before other handlers
    document.addEventListener('mousedown', (e) => {
      // Only hide if menu is visible and click is outside
      if (this.isVisible && !this.container.contains(e.target as Node)) {
        this.hide();
      }
    });
    
    // Hide on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    });
  }

  private createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'context-menu';
    container.style.cssText = `
      position: fixed;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      padding: 4px 0;
      min-width: 180px;
      z-index: 10000;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
    `;
    return container;
  }

  show(items: ContextMenuItem[], position: Point): void {
    console.log('ContextMenu.show called with', items.length, 'items at', position);
    // Clear previous items
    this.container.innerHTML = '';
    
    // Add menu items
    items.forEach(item => {
      if (item.divider) {
        const divider = document.createElement('div');
        divider.style.cssText = `
          height: 1px;
          background: #e0e0e0;
          margin: 4px 0;
        `;
        this.container.appendChild(divider);
      } else {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item';
        menuItem.style.cssText = `
          padding: 8px 16px;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        `;
        
        if (item.icon) {
          const icon = document.createElement('span');
          icon.innerHTML = item.icon;
          icon.style.cssText = `
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.7;
          `;
          menuItem.appendChild(icon);
        }
        
        const label = document.createElement('span');
        label.textContent = item.label;
        menuItem.appendChild(label);
        
        menuItem.addEventListener('mouseenter', () => {
          menuItem.style.background = '#f0f0f0';
        });
        
        menuItem.addEventListener('mouseleave', () => {
          menuItem.style.background = 'transparent';
        });
        
        menuItem.addEventListener('click', (e) => {
          e.stopPropagation();
          item.action();
          this.hide();
        });
        
        this.container.appendChild(menuItem);
      }
    });
    
    // Position the menu
    this.container.style.display = 'block';
    this.container.style.visibility = 'visible';
    this.container.style.left = `${position.x}px`;
    this.container.style.top = `${position.y}px`;
    
    // Adjust position if menu goes outside viewport
    requestAnimationFrame(() => {
      const rect = this.container.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        this.container.style.left = `${position.x - rect.width}px`;
      }
      if (rect.bottom > window.innerHeight) {
        this.container.style.top = `${position.y - rect.height}px`;
      }
    });
    
    this.isVisible = true;
    
    // Prevent the click that opened the menu from closing it
    setTimeout(() => {
      // Small delay to ensure the menu is considered "open" for click outside detection
    }, 0);
    
    console.log('Menu should be visible now');
  }

  hide(): void {
    this.container.style.display = 'none';
    this.isVisible = false;
  }

  destroy(): void {
    this.container.remove();
  }
}
