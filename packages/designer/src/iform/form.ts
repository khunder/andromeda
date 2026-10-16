/**
 * A rendered form: fields generated into a root pane, its data, validation
 * and submit. Created by iform.create() (see ./index.ts).
 */
import { createTranslate } from './i18n';
import type { InputRegistry } from './registry';
import type {
  FieldGenerator, FieldHandle, IFormClasses, IFormComponent, IFormData, IFormDefinition, IFormI18n,
  IFormOptions, InputContext, InputDefinition, RootPane, Translate,
} from './types';

export interface IFormError {
  key: string;
  message: string;
}

/** Thrown (rejected) by submit() when the form doesn't validate. */
export class IFormValidationError extends Error {
  constructor(readonly errors: IFormError[]) {
    super(errors.map((error) => `${error.key}: ${error.message}`).join('; '));
    this.name = 'IFormValidationError';
  }
}

interface Field {
  component: IFormComponent;
  input: InputDefinition;
  handle: FieldHandle;
}

export interface IFormEnvironment {
  registry: InputRegistry;
  classes: IFormClasses;
  generator: FieldGenerator;
  i18nPrefix: string;
  /** read on every translation - the host may set iform.i18n at any time */
  i18n: () => IFormI18n | undefined;
}

let formCounter = 0;

export class IForm {
  readonly definition: IFormDefinition;
  private readonly fields = new Map<string, Field>();
  private readonly listeners = new Set<(data: IFormData) => void>();
  private readonly t: Translate;
  private readonly idPrefix: string;
  private fieldCounter = 0;
  private destroyed = false;

  constructor(readonly pane: RootPane, definition: IFormDefinition, private readonly env: IFormEnvironment, private readonly options: IFormOptions = {}) {
    this.definition = definition && Array.isArray(definition.components) ? definition : { display: 'form', components: [] };
    this.idPrefix = options.idPrefix ?? `iform-${++formCounter}`;
    this.t = createTranslate(() => options.i18n ?? env.i18n());
    this.render();
  }

  private render(): void {
    this.pane.clear();
    this.pane.element.classList.add(...this.env.classes.root.split(/\s+/).filter(Boolean));
    this.renderComponents(this.definition.components, this.pane);
    this.setData(this.options.data ?? {});
  }

  private renderComponents(components: IFormComponent[], pane: RootPane): void {
    for (const component of components || []) {
      const input = this.env.registry.resolve(component?.type);
      if (!input) {
        console.warn(`[iform] no input registered for type "${component?.type}" - skipped`, component);
        continue;
      }
      const ctx = this.context(component);
      const generator = this.options.generator ?? this.env.generator;
      const handle = input.render ? input.render(ctx, generator) : generator(input, ctx);
      pane.append(handle.element);
      if (!input.layout && component.key && handle.control) {
        if (this.fields.has(component.key)) console.warn(`[iform] duplicate key "${component.key}"`);
        this.fields.set(component.key, { component, input, handle });
        if (component.disabled || this.options.readOnly) handle.control.setDisabled(true);
      }
    }
  }

  private context(component: IFormComponent): InputContext {
    const prefix = this.env.i18nPrefix;
    const name = component.key ?? component.type;
    return {
      component,
      id: `${this.idPrefix}-${(component.key ?? component.type).replace(/[^\w-]/g, '_')}-${++this.fieldCounter}`,
      classes: this.env.classes,
      t: this.t,
      text: (part, fallback) => (fallback ? this.t(`${prefix}${name}.${part}`, fallback) : ''),
      changed: () => this.emitChange(),
      renderChildren: (children, pane) => this.renderComponents(children, pane),
    };
  }

  private emitChange(): void {
    if (this.destroyed) return;
    const data = this.data;
    this.listeners.forEach((listener) => listener(data));
  }

  /** Every field's value, by key. */
  get data(): IFormData {
    const data: IFormData = {};
    this.fields.forEach((field, key) => { data[key] = field.handle.control!.getValue(); });
    return data;
  }

  set data(values: IFormData) {
    this.setData(values);
  }

  /** Sets the fields named in `values`; the others get their defaultValue. */
  setData(values: IFormData): void {
    this.fields.forEach((field, key) => {
      const value = values && key in values ? values[key] : field.component.defaultValue;
      field.handle.control!.setValue(value);
    });
  }

  /** Keys of the fields that can be edited - not disabled, form not read-only. */
  editableKeys(): string[] {
    if (this.options.readOnly) return [];
    return [...this.fields.values()].filter((field) => !field.component.disabled).map((field) => field.component.key!);
  }

  on(event: 'change', listener: (data: IFormData) => void): () => void {
    if (event !== 'change') throw new Error(`[iform] unknown event "${event}"`);
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Checks every editable field and shows the messages; returns the errors. */
  validate(): IFormError[] {
    const errors: IFormError[] = [];
    this.fields.forEach((field, key) => {
      const message = field.component.disabled || this.options.readOnly ? null : this.check(field);
      field.handle.showError(message);
      if (message) errors.push({ key, message });
    });
    return errors;
  }

  private check({ component, input, handle }: Field): string | null {
    const value = handle.control!.getValue();
    const rules = component.validate || {};
    const custom = (message: string) => (rules.customMessage ? this.t(`${this.env.i18nPrefix}${component.key}.customMessage`, rules.customMessage) : message);
    const empty = input.isEmpty ? input.isEmpty(value) : value == null || value === '';

    if (empty) {
      return rules.required ? custom(this.t('iform.validation.required', 'This field is required')) : null;
    }
    const typeError = input.validate?.(value, component, this.t);
    if (typeError) return custom(typeError);

    if (typeof value === 'string') {
      if (rules.minLength != null && value.length < rules.minLength) {
        return custom(this.t('iform.validation.minLength', 'At least {{minLength}} characters', { minLength: rules.minLength }));
      }
      if (rules.maxLength != null && value.length > rules.maxLength) {
        return custom(this.t('iform.validation.maxLength', 'At most {{maxLength}} characters', { maxLength: rules.maxLength }));
      }
      if (rules.pattern) {
        let pattern: RegExp | null = null;
        try {
          pattern = new RegExp(`^(?:${rules.pattern})$`);
        } catch {
          console.warn(`[iform] invalid pattern on "${component.key}": ${rules.pattern}`);
        }
        if (pattern && !pattern.test(value)) return custom(this.t('iform.validation.pattern', 'Invalid format'));
      }
    }
    if (typeof value === 'number') {
      if (rules.min != null && value < rules.min) return custom(this.t('iform.validation.min', 'Must be at least {{min}}', { min: rules.min }));
      if (rules.max != null && value > rules.max) return custom(this.t('iform.validation.max', 'Must be at most {{max}}', { max: rules.max }));
    }
    return null;
  }

  /**
   * Waits for pending input work (files being read), validates, and resolves
   * with the data - or rejects with an IFormValidationError, focusing the
   * first invalid field.
   */
  async submit(): Promise<IFormData> {
    await Promise.all([...this.fields.values()].map((field) => field.handle.control!.settle?.()));
    const errors = this.validate();
    if (errors.length > 0) {
      this.fields.get(errors[0].key)?.handle.control?.focus?.();
      throw new IFormValidationError(errors);
    }
    return this.data;
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
    this.fields.clear();
    this.pane.clear();
    this.pane.dispose?.();
  }
}
