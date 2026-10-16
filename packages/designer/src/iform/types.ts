/**
 * iform - a small form generator for human tasks (see ./index.ts).
 *
 * A form is saved as JSON shaped like a form.io definition:
 *   { "display": "form", "components": [ { "type": "string", "key": "comment", "label": "Comment" }, ... ] }
 * Component types are the process variable types (string, number, boolean,
 * Date, object, file) plus layout types (panel); form.io names (textfield,
 * checkbox, textarea, ...) are accepted as aliases.
 */

/** Validation rules of a component - same names as form.io. */
export interface IFormValidate {
  required?: boolean;
  /** regular expression the whole (string) value must match */
  pattern?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  /** replaces the built-in message of any failed rule */
  customMessage?: string;
}

export interface IFormComponent {
  type: string;
  /** the value's name in the form data - a field named like a process variable sets it */
  key?: string;
  label?: string;
  placeholder?: string;
  /** help text under the field */
  description?: string;
  defaultValue?: unknown;
  /** shown, never edited (and never submitted as a change) */
  disabled?: boolean;
  hidden?: boolean;
  validate?: IFormValidate;
  /** layout types (panel): nested components */
  components?: IFormComponent[];
  /**
   * Which control edits the value - the type says what the value is, the
   * hint how it's entered: input, textarea, checkbox, switch, radio, select,
   * date, datetime... (see iform.uiHintsFor(type)). Unknown or unsupported
   * for the type: the type's default control.
   */
  ui_hint?: string;
  /** choices of radio / select: [{ label, value }] or plain values */
  values?: Array<IFormChoice | string | number | boolean>;
  /** string: render a multi-line text area (same as ui_hint "textarea") */
  multiline?: boolean;
  rows?: number;
  /** form.io's input flag - false on layout components; ignored otherwise */
  input?: boolean;
  /** anything else an input type understands */
  [option: string]: unknown;
}

export interface IFormChoice {
  label: string;
  value: string | number | boolean;
}

export interface IFormDefinition {
  display?: string;
  title?: string;
  components: IFormComponent[];
  [key: string]: unknown;
}

export type IFormData = Record<string, unknown>;

/**
 * Translation hook. Either an object with t(), or a plain dictionary
 * { "iform.validation.required": "Champ obligatoire", ... }.
 */
export type IFormI18n =
  | { t: (key: string, fallback: string, params?: Record<string, unknown>) => string }
  | Record<string, string>;

/** CSS class names the generated markup uses - point them at the host application's styles. */
export interface IFormClasses {
  root: string;
  field: string;
  fieldInline: string;
  label: string;
  control: string;
  description: string;
  error: string;
  invalid: string;
  required: string;
  panel: string;
  panelTitle: string;
}

/**
 * Where a form puts its fields. The default wraps an element; a host
 * application can pass its own (e.g. a native panel) - the form only calls
 * these methods.
 */
export interface RootPane {
  readonly element: HTMLElement;
  append(node: HTMLElement): void;
  clear(): void;
  /** called by IForm.destroy() */
  dispose?(): void;
}

export type Translate = (key: string, fallback: string, params?: Record<string, unknown>) => string;

/** A rendered control - what an input definition gives the generator. */
export interface InputControl {
  /** the editable element(s) */
  element: HTMLElement;
  getValue(): unknown;
  setValue(value: unknown): void;
  setDisabled(disabled: boolean): void;
  /** the element a <label for> points to, when not `element` */
  labelTarget?: HTMLElement;
  focus?(): void;
  /** resolves once pending work (e.g. reading a picked file) is done - awaited by submit() */
  settle?(): Promise<void>;
}

export interface InputContext {
  component: IFormComponent;
  /** the value's type (string, number, boolean, Date, object, file) - type aliases resolved */
  valueType: string;
  /** the ui_hint this control was picked for, if any */
  uiHint: string | undefined;
  /** unique DOM id for the control */
  id: string;
  classes: IFormClasses;
  t: Translate;
  /** the component's own text, translated: key <i18nPrefix><component key>.<part> (label, placeholder, description, values.<value>) */
  text(part: string, fallback: string | undefined): string;
  /** call on every user edit */
  changed(): void;
  /** layout inputs: render nested components into a pane */
  renderChildren(components: IFormComponent[], pane: RootPane): void;
}

/** A field as placed in the form - what the generator returns. */
export interface FieldHandle {
  element: HTMLElement;
  control: InputControl | null;
  showError(message: string | null): void;
}

/** One input type. Registered by type name (see registry.ts). */
export interface InputDefinition {
  type: string;
  /** other type names it answers to - form.io names, for instance */
  aliases?: string[];
  /** layout component: no value of its own, renders children */
  layout?: boolean;
  /**
   * ui_hint values this definition renders. A type's own definition lists
   * the hints it handles itself (e.g. string: input, textarea); a hint-only
   * definition (radio, select...) is picked by ui_hint for the types in forTypes.
   */
  uiHints?: string[];
  /** the value types a hint definition can edit - only its own value type when absent */
  forTypes?: string[];
  /** the value type when this definition is used as a component type (radio -> string) */
  valueType?: string;
  /** label after the control (checkboxes) */
  inlineLabel?: boolean;
  /** build the control - the generator wraps it with label, help and error */
  create(ctx: InputContext): InputControl;
  /** type-specific check, after the common rules; returns an error message or null */
  validate?(value: unknown, component: IFormComponent, t: Translate): string | null;
  isEmpty?(value: unknown): boolean;
  /** replace the generator for this type: build the whole field */
  render?(ctx: InputContext, generator: FieldGenerator): FieldHandle;
}

/** Builds a field (label + control + help + error) around an input. */
export type FieldGenerator = (input: InputDefinition, ctx: InputContext) => FieldHandle;

export interface IFormOptions {
  /** initial values by key */
  data?: IFormData;
  /** every field read-only */
  readOnly?: boolean;
  /** overrides the configured class names */
  classes?: Partial<IFormClasses>;
  /** overrides iform.i18n for this form */
  i18n?: IFormI18n;
  /** overrides the default field generator */
  generator?: FieldGenerator;
  /** id prefix of the generated controls */
  idPrefix?: string;
}

export interface IFormConfig {
  classes: IFormClasses;
  /** i18n key prefix of labels, placeholders and descriptions: <prefix><key>.label */
  i18nPrefix: string;
  /** input definitions registered when iform is created */
  inputs: InputDefinition[];
}
