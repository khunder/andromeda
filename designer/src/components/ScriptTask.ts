// Script Task Component with JavaScript execution support

import { ComponentDefinition, BPMNElement, Point, ExecutionContext } from '../types';

export const ScriptTaskComponent: ComponentDefinition = {
  type: 'scriptTask',
  category: 'task',
  label: 'Script Task',
  icon: '📜',
  defaultSize: { width: 100, height: 80 },
  resizable: true,
  
  properties: [
    {
      name: 'scriptLanguage',
      label: 'Script Language',
      type: 'select',
      default: 'javascript',
      options: [
        { value: 'javascript', label: 'JavaScript' },
        { value: 'python', label: 'Python (External)' },
        { value: 'groovy', label: 'Groovy (External)' }
      ]
    },
    {
      name: 'script',
      label: 'Script',
      type: 'code',
      default: '// Write your JavaScript code here\n// Available: variables, services, logger\n\nlogger.log("Script task executed");\nreturn { success: true };'
    },
    {
      name: 'resultVariable',
      label: 'Result Variable',
      type: 'string',
      default: 'scriptResult'
    },
    {
      name: 'async',
      label: 'Asynchronous',
      type: 'boolean',
      default: false
    },
    {
      name: 'timeout',
      label: 'Timeout (ms)',
      type: 'number',
      default: 5000,
      visible: (element) => element.properties?.async === true
    }
  ],

  connectionRules: {
    maxIncoming: -1, // Unlimited
    maxOutgoing: -1, // Unlimited
    canConnect: (source, target) => {
      // Script tasks can connect to any element except start events
      return !target.type.includes('startEvent');
    }
  },

  renderer: {
    render(element: BPMNElement, container: SVGGElement): SVGElement {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('data-element-id', element.id);
      g.setAttribute('class', 'bpmn-script-task');
      
      // Main task rectangle
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(element.bounds.x));
      rect.setAttribute('y', String(element.bounds.y));
      rect.setAttribute('width', String(element.bounds.width));
      rect.setAttribute('height', String(element.bounds.height));
      rect.setAttribute('rx', '10');
      rect.setAttribute('fill', '#fff');
      rect.setAttribute('stroke', '#000');
      rect.setAttribute('stroke-width', '2');
      g.appendChild(rect);

      // Script icon (scroll/document icon)
      const iconSize = 15;
      const iconX = element.bounds.x + 5;
      const iconY = element.bounds.y + 5;
      
      // Create scroll icon
      const scriptPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const d = `
        M ${iconX} ${iconY}
        L ${iconX + iconSize * 0.8} ${iconY}
        L ${iconX + iconSize} ${iconY + iconSize * 0.2}
        L ${iconX + iconSize} ${iconY + iconSize}
        L ${iconX} ${iconY + iconSize}
        Z
        M ${iconX + iconSize * 0.8} ${iconY}
        L ${iconX + iconSize * 0.8} ${iconY + iconSize * 0.2}
        L ${iconX + iconSize} ${iconY + iconSize * 0.2}
      `;
      scriptPath.setAttribute('d', d.trim());
      scriptPath.setAttribute('fill', 'none');
      scriptPath.setAttribute('stroke', '#000');
      scriptPath.setAttribute('stroke-width', '1.5');
      g.appendChild(scriptPath);

      // Add lines to represent code
      for (let i = 0; i < 3; i++) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const lineY = iconY + iconSize * 0.35 + (i * iconSize * 0.2);
        line.setAttribute('x1', String(iconX + iconSize * 0.15));
        line.setAttribute('y1', String(lineY));
        line.setAttribute('x2', String(iconX + iconSize * 0.65));
        line.setAttribute('y2', String(lineY));
        line.setAttribute('stroke', '#000');
        line.setAttribute('stroke-width', '1');
        g.appendChild(line);
      }

      // Language badge
      const language = element.properties?.scriptLanguage || 'javascript';
      const badge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const badgeX = element.bounds.x + element.bounds.width - 25;
      const badgeY = element.bounds.y + 5;
      
      const badgeRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      badgeRect.setAttribute('x', String(badgeX));
      badgeRect.setAttribute('y', String(badgeY));
      badgeRect.setAttribute('width', '20');
      badgeRect.setAttribute('height', '12');
      badgeRect.setAttribute('rx', '2');
      badgeRect.setAttribute('fill', language === 'javascript' ? '#f7df1e' : '#666');
      badge.appendChild(badgeRect);
      
      const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      badgeText.setAttribute('x', String(badgeX + 10));
      badgeText.setAttribute('y', String(badgeY + 9));
      badgeText.setAttribute('text-anchor', 'middle');
      badgeText.setAttribute('font-size', '8');
      badgeText.setAttribute('font-family', 'monospace');
      badgeText.setAttribute('fill', language === 'javascript' ? '#000' : '#fff');
      badgeText.textContent = language === 'javascript' ? 'JS' : language.substring(0, 2).toUpperCase();
      badge.appendChild(badgeText);
      g.appendChild(badge);

      // Label
      if (element.label) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(element.bounds.x + element.bounds.width / 2));
        text.setAttribute('y', String(element.bounds.y + element.bounds.height / 2));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-family', 'Arial, sans-serif');
        text.textContent = element.label;
        g.appendChild(text);
      }

      container.appendChild(g);
      return g;
    },

    getConnectionPoint(element: BPMNElement, reference: Point, type: 'source' | 'target'): Point {
      const centerX = element.bounds.x + element.bounds.width / 2;
      const centerY = element.bounds.y + element.bounds.height / 2;
      
      // Calculate which edge to connect to
      const points = [
        { x: centerX, y: element.bounds.y }, // top
        { x: element.bounds.x + element.bounds.width, y: centerY }, // right
        { x: centerX, y: element.bounds.y + element.bounds.height }, // bottom
        { x: element.bounds.x, y: centerY } // left
      ];
      
      // Find closest point to reference
      let closestPoint = points[0];
      let minDistance = Math.hypot(points[0].x - reference.x, points[0].y - reference.y);
      
      for (let i = 1; i < points.length; i++) {
        const distance = Math.hypot(points[i].x - reference.x, points[i].y - reference.y);
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = points[i];
        }
      }
      
      return closestPoint;
    }
  },

  behavior: {
    onCreate(element: BPMNElement): void {
      console.log(`Created script task: ${element.id}`);
    },

    onUpdate(element: BPMNElement, changes: Partial<BPMNElement>): void {
      if (changes.properties?.script) {
        // Validate JavaScript syntax
        try {
          new Function('variables', 'services', 'logger', changes.properties.script);
        } catch (error) {
          console.error('Script syntax error:', error);
        }
      }
    },

    async onExecute(element: BPMNElement, context: ExecutionContext): Promise<any> {
      const script = element.properties?.script || '';
      const language = element.properties?.scriptLanguage || 'javascript';
      const resultVariable = element.properties?.resultVariable || 'scriptResult';
      const isAsync = element.properties?.async || false;
      const timeout = element.properties?.timeout || 5000;

      context.logger.log(`Executing script task: ${element.id} (${language})`);

      if (language !== 'javascript') {
        context.logger.warn(`Script language "${language}" is not supported for execution. Only JavaScript is supported.`);
        return { error: 'Unsupported script language' };
      }

      try {
        // Create a sandboxed function
        const scriptFunction = new Function(
          'variables', 
          'services', 
          'logger',
          'signal',
          script
        );

        // Execute the script
        const executeScript = () => {
          return scriptFunction(
            context.variables,
            context.services,
            context.logger,
            context.signal
          );
        };

        let result;
        if (isAsync) {
          // Execute with timeout
          result = await Promise.race([
            Promise.resolve(executeScript()),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Script execution timeout')), timeout)
            )
          ]);
        } else {
          result = executeScript();
        }

        // Store result in context
        if (resultVariable && result !== undefined) {
          context.variables.set(resultVariable, result);
        }

        context.logger.log(`Script task completed: ${element.id}`);
        return result;
      } catch (error) {
        context.logger.error(`Script task error in ${element.id}:`, error);
        throw error;
      }
    }
  }
};
