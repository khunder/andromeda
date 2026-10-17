import type { BpmnExample } from './examples';
import { blankProcessXml, readDefinitionsId } from './WorkflowModel';

export interface AddProcessOptions {
  examples: BpmnExample[];
  /** process definitions already in the workflow - the new one must differ */
  existingDefs: string[];
  version: string;
  onAdd: (process: { processDef: string; xml: string }) => void;
}

/**
 * "Add a process" dialog (the + button / context menu of the Andromeda
 * panel): a blank process or one of the engine's example diagrams, under a
 * process definition id of the user's choosing.
 */
export class AddProcessModal {
  private modal: HTMLDivElement | null = null;

  show(options: AddProcessOptions): void {
    this.hide();
    const modal = document.createElement('div');
    modal.className = 'add-process-modal';
    modal.innerHTML = `
      <div class="add-process-overlay"></div>
      <div class="add-process-dialog" role="dialog" aria-labelledby="add-process-title">
        <div class="add-process-header">
          <h2 id="add-process-title">Add a process</h2>
          <button class="add-process-close" type="button" title="Close">×</button>
        </div>
        <div class="add-process-body">
          <div class="add-process-sources" role="radiogroup" aria-label="Start from">
            <label class="add-process-source selected">
              <input type="radio" name="add-process-source" value="blank" checked>
              <span class="add-process-source-title">New process</span>
              <span class="add-process-source-hint">A start event, nothing else</span>
            </label>
            <label class="add-process-source">
              <input type="radio" name="add-process-source" value="example">
              <span class="add-process-source-title">From an example</span>
              <span class="add-process-source-hint">One of the engine's test scenarios</span>
            </label>
          </div>
          <div class="property-group add-process-example" hidden>
            <label for="add-process-example">Example</label>
            <select id="add-process-example">
              ${options.examples.map((example) => `<option value="${escapeHtml(example.path)}">${escapeHtml(example.label)}</option>`).join('')}
            </select>
          </div>
          <div class="property-group">
            <label for="add-process-def">Process definition id</label>
            <input id="add-process-def" type="text" spellcheck="false" placeholder="e.g. order-approval">
            <small>Becomes the <code>&lt;bpmn:definitions id&gt;</code> - the container serves the process under this name. Version ${escapeHtml(options.version)} comes from the workflow.</small>
            <div class="add-process-error" role="alert"></div>
          </div>
        </div>
        <div class="add-process-footer">
          <button class="xml-btn" type="button" id="add-process-cancel">Cancel</button>
          <button class="xml-btn add-process-confirm" type="button" id="add-process-confirm">Add</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    this.modal = modal;

    const defInput = modal.querySelector<HTMLInputElement>('#add-process-def')!;
    const exampleSelect = modal.querySelector<HTMLSelectElement>('#add-process-example')!;
    const exampleGroup = modal.querySelector<HTMLElement>('.add-process-example')!;
    const error = modal.querySelector<HTMLElement>('.add-process-error')!;
    const radios = Array.from(modal.querySelectorAll<HTMLInputElement>('input[name="add-process-source"]'));
    const source = () => radios.find((radio) => radio.checked)?.value ?? 'blank';

    const uniqueDef = (base: string) => {
      let candidate = base;
      for (let n = 2; options.existingDefs.includes(candidate); n++) {
        candidate = `${base}-${n}`;
      }
      return candidate;
    };
    const suggestDef = () => {
      if (source() === 'example') {
        const example = options.examples.find((e) => e.path === exampleSelect.value);
        defInput.value = uniqueDef(readDefinitionsId(example?.xml ?? '') || 'process');
      } else {
        defInput.value = uniqueDef('process');
      }
    };

    radios.forEach((radio) => radio.addEventListener('change', () => {
      modal.querySelectorAll('.add-process-source').forEach((label) => label.classList.toggle('selected', label.contains(radio) && radio.checked));
      exampleGroup.hidden = source() !== 'example';
      suggestDef();
    }));
    exampleSelect.addEventListener('change', suggestDef);
    suggestDef();

    const confirm = () => {
      const processDef = defInput.value.trim();
      if (!processDef) {
        error.textContent = 'A process definition id is required.';
        return;
      }
      if (!/^[A-Za-z_][\w.-]*$/.test(processDef)) {
        error.textContent = 'Use letters, digits, "_", "-" or "." - starting with a letter.';
        return;
      }
      if (options.existingDefs.includes(processDef)) {
        error.textContent = `The workflow already has a process "${processDef}".`;
        return;
      }
      let xml: string;
      if (source() === 'example') {
        const example = options.examples.find((e) => e.path === exampleSelect.value);
        if (!example) {
          error.textContent = 'Pick an example.';
          return;
        }
        xml = example.xml;
      } else {
        xml = blankProcessXml(processDef, options.version);
      }
      this.hide();
      options.onAdd({ processDef, xml });
    };

    modal.querySelector('.add-process-overlay')?.addEventListener('click', () => this.hide());
    modal.querySelector('.add-process-close')?.addEventListener('click', () => this.hide());
    modal.querySelector('#add-process-cancel')?.addEventListener('click', () => this.hide());
    modal.querySelector('#add-process-confirm')?.addEventListener('click', confirm);
    modal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.hide();
      } else if (event.key === 'Enter' && (event.target as HTMLElement).matches('input, select')) {
        event.preventDefault();
        confirm();
      }
    });

    defInput.focus();
    defInput.select();
  }

  hide(): void {
    this.modal?.remove();
    this.modal = null;
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
