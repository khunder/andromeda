/**
 * Human task form dialogs (see BPMNDesigner's user task properties), all on iform:
 * - edit(): the form's JSON in Monaco beside a live preview; resolves with
 *   the edited definition on Save, or null on Cancel - the caller stores it
 *   in the task's <andromeda:form>.
 * - pickVariables(): the "Generate form" dialog - choose the variables a
 *   generated form gets fields for.
 * - preview(): the form alone, as the task's worklist renders it.
 */
import { loadMonaco } from './MonacoLoader';
import { iform, IFormValidationError, type FormVariable, type IForm, type IFormDefinition } from '../iform';

declare const monaco: any;

const EMPTY_FORM: IFormDefinition = { display: 'form', components: [] };

export class FormBuilderModal {
  private modal: HTMLDivElement | null = null;
  private forms: IForm[] = [];
  private editor: any = null;

  /** The form's JSON beside a live preview. */
  edit(title: string, form: IFormDefinition | null, variables: FormVariable[]): Promise<IFormDefinition | null> {
    this.close();
    const modal = this.openModal('form-editor', `Form · ${title}`,
      'Edit the form as JSON - the preview follows. A field whose <code>key</code> is a process variable sets it when the task is accepted; <code>"disabled": true</code> only shows it.', `
        <div class="form-editor-split">
          <div class="form-editor-source">
            <div class="form-editor-toolbar">
              <select class="form-editor-add" aria-label="Add a field for a variable"></select>
            </div>
            <div class="form-editor-code"></div>
          </div>
          <div class="form-editor-preview">
            <div class="form-editor-status" role="status"></div>
            <div class="form-editor-render"></div>
          </div>
        </div>`, [
        { action: 'cancel', label: 'Cancel' },
        { action: 'save', label: 'Save form', primary: true },
      ]);

    const status = modal.querySelector('.form-editor-status') as HTMLElement;
    const renderHost = modal.querySelector('.form-editor-render') as HTMLElement;
    const codeHost = modal.querySelector('.form-editor-code') as HTMLElement;
    const saveButton = modal.querySelector('[data-action="save"]') as HTMLButtonElement;
    const initial = JSON.stringify(form && Array.isArray(form.components) ? form : EMPTY_FORM, null, 2);

    // a plain text area until Monaco is there (or if it can't load)
    const fallback = document.createElement('textarea');
    fallback.className = 'form-editor-fallback';
    fallback.spellcheck = false;
    fallback.value = initial;
    codeHost.append(fallback);
    let getText = () => fallback.value;
    let setText = (text: string) => { fallback.value = text; };

    let current: IFormDefinition | null = null;
    const refresh = () => {
      const parsed = this.parseForm(getText());
      this.destroyForms();
      if (typeof parsed === 'string') {
        current = null;
        status.textContent = parsed;
        status.classList.add('error');
        saveButton.disabled = true;
        return;
      }
      current = parsed;
      // a ui_hint that can't edit its field's type falls back to the default control
      const unusable = [...iform.formComponents(parsed).values()]
        .filter((component) => component.ui_hint && !iform.registry.resolveComponent(component)?.uiHint)
        .map((component) => `${component.key}: ui_hint "${component.ui_hint}" (use ${iform.uiHintsFor(iform.registry.resolveComponent(component)?.valueType ?? 'string').join(' / ')})`);
      status.textContent = `${iform.formFieldKeys(parsed).length} field(s)${unusable.length ? ` - ignored: ${unusable.join('; ')}` : ''}`;
      status.classList.toggle('error', unusable.length > 0);
      saveButton.disabled = false;
      renderHost.replaceChildren();
      this.forms.push(iform.create(renderHost, parsed));
    };
    let timer: number | undefined;
    const refreshSoon = () => { window.clearTimeout(timer); timer = window.setTimeout(refresh, 250); };
    fallback.addEventListener('input', refreshSoon);
    refresh();

    // "+ Add field" for a variable the form doesn't have yet
    const add = modal.querySelector('.form-editor-add') as HTMLSelectElement;
    const fillAdd = () => {
      const present = new Set(current ? iform.formFieldKeys(current) : []);
      const options = variables.filter((variable) => !present.has(variable.name))
        .map((variable) => new Option(`${variable.name} (${variable.type})`, variable.name));
      add.replaceChildren(new Option(options.length ? '+ Add field for a variable…' : 'Every variable has a field', ''), ...options);
      add.disabled = options.length === 0;
    };
    fillAdd();
    add.addEventListener('focus', fillAdd);
    add.addEventListener('change', () => {
      const variable = variables.find((candidate) => candidate.name === add.value);
      add.value = '';
      if (!variable || !current) return;
      const next = { ...current, components: [...current.components, iform.componentForVariable(variable)] };
      setText(JSON.stringify(next, null, 2));
      refresh();
      fillAdd();
    });

    loadMonaco().then(() => {
      if (this.modal !== modal) return;
      const text = fallback.value;
      fallback.remove();
      this.editor = monaco.editor.create(codeHost, {
        value: text,
        language: 'json',
        theme: 'vs',
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 12,
        tabSize: 2,
        insertSpaces: true,
        formatOnPaste: true,
      });
      getText = () => this.editor.getValue();
      setText = (next) => this.editor.setValue(next);
      this.editor.onDidChangeModelContent(refreshSoon);
    }).catch(() => {
      // offline - the text area stays
    });

    return new Promise((resolve) => {
      this.onFinish(modal, (action) => {
        if (action !== 'save') return null;
        const parsed = this.parseForm(getText());
        return typeof parsed === 'string' ? undefined : parsed;
      }, resolve);
    });
  }

  /** The form alone, as the worklist renders it - fields can be tried out, nothing is sent. */
  preview(title: string, form: IFormDefinition): void {
    this.close();
    const modal = this.openModal('form-preview', `Preview · ${title}`,
      "What the task's assignee fills in before accepting. Preview only - nothing is saved or sent.",
      '<div class="form-preview-render"></div>', [
        { action: 'validate', label: 'Check fields', title: 'Run the form validation, like Accept does' },
        { action: 'cancel', label: 'Close', primary: true },
      ]);
    const rendered = iform.create(modal.querySelector('.form-preview-render') as HTMLElement, JSON.parse(JSON.stringify(form)));
    this.forms.push(rendered);
    const note = modal.querySelector('.form-modal-note') as HTMLElement;
    modal.querySelector('[data-action="validate"]')!.addEventListener('click', async () => {
      try {
        await rendered.submit();
        note.textContent = '✓ The form would be accepted.';
      } catch (error) {
        note.textContent = error instanceof IFormValidationError ? 'Fix the highlighted fields.' : String(error);
      }
    });
    this.onFinish(modal, () => null, () => {});
  }

  /**
   * Picks the variables to generate a form from: which ones get a field, and
   * which of those are read-only. Resolves in the variables' declared order,
   * or null on Cancel.
   */
  pickVariables(title: string, variables: FormVariable[], current: FormVariable[]): Promise<FormVariable[] | null> {
    this.close();
    const modal = this.openModal('form-picker', `Generate form · ${title}`,
      "One field per selected variable, typed by the variable's type; Control picks how it's entered (ui_hint) - radio / select choices are then edited in the form JSON. Editable fields set the variable when the task is accepted; read-only ones only show its value.", `
        <table class="form-picker-table">
          <thead><tr>
            <th><input type="checkbox" class="pick-all" aria-label="Select all"></th>
            <th>Variable</th><th>Type</th><th>Control</th><th>Read-only</th>
          </tr></thead>
          <tbody></tbody>
        </table>`, [
        { action: 'cancel', label: 'Cancel' },
        { action: 'save', label: 'Generate form', primary: true },
      ]);
    (modal.querySelector('.form-modal-note') as HTMLElement).textContent = current.length > 0 ? 'Replaces the current form.' : '';

    const selected = new Map(current.map((variable) => [variable.name, variable]));
    const tbody = modal.querySelector('tbody')!;
    const all = modal.querySelector('.pick-all') as HTMLInputElement;
    const includes = () => Array.from(tbody.querySelectorAll<HTMLInputElement>('.pick-include'));
    const syncAll = () => {
      const boxes = includes();
      all.checked = boxes.length > 0 && boxes.every((box) => box.checked);
      all.indeterminate = !all.checked && boxes.some((box) => box.checked);
    };
    for (const variable of variables) {
      const row = document.createElement('tr');
      row.dataset.name = variable.name;
      const include = Object.assign(document.createElement('input'), { type: 'checkbox', className: 'pick-include', checked: selected.has(variable.name) });
      include.setAttribute('aria-label', `Include ${variable.name}`);
      const readOnly = Object.assign(document.createElement('input'), { type: 'checkbox', className: 'pick-readonly', checked: !!selected.get(variable.name)?.readOnly, disabled: !include.checked });
      readOnly.setAttribute('aria-label', `${variable.name} read-only`);
      // ui_hint: the controls that can edit this type, its default first
      const control = document.createElement('select');
      control.className = 'pick-control';
      control.setAttribute('aria-label', `${variable.name} control`);
      const hints = iform.uiHintsFor(variable.type);
      hints.forEach((hint, index) => control.append(new Option(index === 0 ? `${hint} (default)` : hint, index === 0 ? '' : hint)));
      control.value = hints.indexOf(selected.get(variable.name)?.uiHint ?? '') > 0 ? selected.get(variable.name)!.uiHint! : '';
      control.disabled = !include.checked || hints.length < 2;
      include.addEventListener('change', () => {
        readOnly.disabled = !include.checked;
        control.disabled = !include.checked || hints.length < 2;
        syncAll();
      });
      for (const content of [include, variable.name, variable.type, control, readOnly]) {
        const cell = document.createElement('td');
        if (typeof content === 'string') cell.textContent = content;
        else cell.appendChild(content);
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    }
    all.addEventListener('change', () => {
      for (const box of includes()) {
        box.checked = all.checked;
        box.dispatchEvent(new Event('change'));
      }
    });
    syncAll();

    return new Promise((resolve) => {
      this.onFinish(modal, (action) => action !== 'save' ? null : Array.from(tbody.querySelectorAll<HTMLTableRowElement>('tr'))
        .filter((row) => (row.querySelector('.pick-include') as HTMLInputElement).checked)
        .map((row) => ({
          ...variables.find((variable) => variable.name === row.dataset.name)!,
          readOnly: (row.querySelector('.pick-readonly') as HTMLInputElement).checked,
          uiHint: (row.querySelector('.pick-control') as HTMLSelectElement).value || undefined,
        })), resolve);
    });
  }

  /** A form definition from JSON, or the reason it isn't one. */
  private parseForm(text: string): IFormDefinition | string {
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`;
    }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.components)) {
      return 'A form needs a "components" array.';
    }
    const unknown = [...iform.formComponents(parsed).values()]
      .map((component) => component.type)
      .filter((type) => !iform.registry.resolve(type));
    if (unknown.length > 0) return `Unknown field type(s): ${[...new Set(unknown)].join(', ')} - known: ${iform.registry.types().join(', ')}`;
    return parsed as IFormDefinition;
  }

  private openModal(kind: string, title: string, hintHtml: string, bodyHtml: string,
    buttons: { action: string; label: string; primary?: boolean; title?: string }[]): HTMLDivElement {
    this.addStyles();
    const modal = document.createElement('div');
    modal.className = 'form-builder-modal';
    modal.innerHTML = `
      <div class="form-builder-overlay"></div>
      <div class="form-builder-content ${kind}" role="dialog" aria-modal="true">
        <div class="form-builder-header">
          <div>
            <h2></h2>
            <p class="form-builder-hint">${hintHtml}</p>
          </div>
          <button class="form-builder-close" title="Close" aria-label="Close">×</button>
        </div>
        <div class="form-builder-body">${bodyHtml}</div>
        <div class="form-builder-footer">
          <span class="form-modal-note"></span>
        </div>
      </div>
    `;
    modal.querySelector('h2')!.textContent = title;
    modal.querySelector('[role="dialog"]')!.setAttribute('aria-label', title);
    const footer = modal.querySelector('.form-builder-footer')!;
    for (const button of buttons) {
      const element = document.createElement('button');
      element.className = button.primary ? 'fb-btn fb-btn-primary' : 'fb-btn';
      element.dataset.action = button.action;
      element.textContent = button.label;
      if (button.title) element.title = button.title;
      footer.appendChild(element);
    }
    document.body.appendChild(modal);
    this.modal = modal;
    return modal;
  }

  /**
   * Wires the closing controls: Cancel, ×, the overlay and Escape resolve
   * null; Save resolves what `result` returns for it (undefined = stay open).
   */
  private onFinish<T>(modal: HTMLDivElement, result: (action: string) => T | null | undefined, resolve: (value: T | null) => void): void {
    const finish = (action: string) => {
      const value = result(action);
      if (value === undefined) return;
      this.close();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.modal === modal) finish('cancel');
    };
    document.addEventListener('keydown', onKey);
    modal.querySelector('.form-builder-overlay')!.addEventListener('click', () => finish('cancel'));
    modal.querySelector('.form-builder-close')!.addEventListener('click', () => finish('cancel'));
    modal.querySelectorAll<HTMLElement>('[data-action="cancel"], [data-action="save"]').forEach((button) => {
      button.addEventListener('click', () => finish(button.dataset.action!));
    });
  }

  private destroyForms(): void {
    this.forms.forEach((form) => form.destroy());
    this.forms = [];
  }

  private close(): void {
    this.destroyForms();
    this.editor?.dispose();
    this.editor = null;
    this.modal?.remove();
    this.modal = null;
  }

  private addStyles(): void {
    if (document.getElementById('form-builder-modal-styles')) return;
    const style = document.createElement('style');
    style.id = 'form-builder-modal-styles';
    style.textContent = `
      .form-builder-modal {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .form-builder-overlay {
        position: absolute;
        inset: 0;
        background: var(--glass-overlay, rgba(0, 0, 0, 0.4));
        backdrop-filter: blur(4px);
      }
      .form-builder-content {
        position: relative;
        display: flex;
        flex-direction: column;
        width: min(720px, 94vw);
        max-height: 90vh;
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(19px);
        border: 1px solid rgba(255, 255, 255, 0.6);
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(31, 35, 64, 0.25);
        overflow: hidden;
      }
      .form-builder-content.form-editor {
        width: min(1200px, 94vw);
        height: min(820px, 92vh);
      }
      .form-builder-content.form-picker { width: min(620px, 94vw); }
      .form-builder-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        padding: 16px 20px 10px;
        border-bottom: 1px solid var(--glass-divider, #e0e0e0);
      }
      .form-builder-header h2 {
        margin: 0;
        font-size: 18px;
        color: var(--text, #1f2340);
      }
      .form-builder-hint {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--text-muted, #5b6080);
      }
      .form-builder-hint code {
        padding: 0 4px;
        border-radius: 4px;
        background: rgba(22, 163, 74, 0.1);
      }
      .form-builder-close {
        border: none;
        background: none;
        font-size: 26px;
        line-height: 1;
        color: var(--text-subtle, #8a8fab);
        cursor: pointer;
      }
      .form-builder-body {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 16px 20px;
      }
      .form-builder-footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 12px 20px;
        border-top: 1px solid var(--glass-divider, #e0e0e0);
      }
      .form-modal-note {
        margin-right: auto;
        align-self: center;
        font-size: 12px;
        color: var(--text-muted, #5b6080);
      }
      .fb-btn {
        padding: 8px 16px;
        border-radius: 10px;
        border: var(--glass-control-border, 1px solid #ddd);
        background: var(--glass-control-bg, white);
        color: var(--text, #1f2340);
        font: inherit;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
      }
      .fb-btn:hover { background: var(--glass-control-bg-hover, #f5f5f5); }
      .fb-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .fb-btn-primary {
        background: var(--accent, #16a34a);
        border-color: var(--accent, #16a34a);
        color: white;
      }
      .fb-btn-primary:hover { background: #15803d; }
      .form-editor .form-builder-body { overflow: hidden; }
      .form-editor-split {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 16px;
        height: 100%;
      }
      .form-editor-source,
      .form-editor-preview {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .form-editor-toolbar { margin-bottom: 8px; }
      .form-editor-add {
        padding: 6px 10px;
        border-radius: 10px;
        border: var(--glass-control-border, 1px solid #ddd);
        background: var(--glass-control-bg, white);
        font: inherit;
        font-size: 13px;
      }
      .form-editor-code {
        flex: 1;
        min-height: 0;
        border: var(--glass-control-border, 1px solid #ddd);
        border-radius: 10px;
        overflow: hidden;
        background: white;
      }
      .form-editor-fallback {
        width: 100%;
        height: 100%;
        border: none;
        padding: 10px;
        resize: none;
        font: 12px ui-monospace, Consolas, monospace;
      }
      .form-editor-status {
        margin-bottom: 8px;
        font-size: 12px;
        color: var(--text-muted, #5b6080);
      }
      .form-editor-status.error { color: #d14343; }
      .form-editor-render {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 14px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.6);
      }
      .form-picker-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        color: var(--text, #1f2340);
      }
      .form-picker-table th {
        text-align: left;
        font-weight: 600;
        font-size: 12px;
        color: var(--text-muted, #5b6080);
        padding: 6px 8px;
        border-bottom: 1px solid var(--glass-divider, #e0e0e0);
      }
      .form-picker-table td {
        padding: 6px 8px;
        border-bottom: 1px solid var(--glass-divider, #eee);
      }
      .pick-control {
        padding: 3px 6px;
        border-radius: 8px;
        border: var(--glass-control-border, 1px solid #ddd);
        background: var(--glass-control-bg, white);
        font: inherit;
        font-size: 12px;
      }
      .form-picker-table td:nth-child(3) {
        font-family: ui-monospace, monospace;
        font-size: 12px;
        color: var(--text-muted, #5b6080);
      }
    `;
    document.head.appendChild(style);
  }
}
