/**
 * The default field generator: wraps an input's control with its label,
 * help text and error message, using the configured class names.
 *
 *   <div class="{field}">                    ({fieldInline} for checkboxes)
 *     <label class="{label}" for="id">Label <span class="{required}">*</span></label>
 *     ...control...
 *     <small class="{description}">help</small>
 *     <div class="{error}" role="alert"></div>
 *   </div>
 *
 * Replace it per form (options.generator) or per type (InputDefinition.render).
 */
import type { FieldGenerator, FieldHandle } from './types';

function addClasses(element: HTMLElement, classNames: string): void {
  element.classList.add(...classNames.split(/\s+/).filter(Boolean));
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, classNames = '', text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  addClasses(element, classNames);
  if (text !== undefined) element.textContent = text;
  return element;
}

export const defaultGenerator: FieldGenerator = (input, ctx) => {
  const { component, classes } = ctx;
  const control = input.create(ctx);

  const field = el('div', input.inlineLabel ? `${classes.field} ${classes.fieldInline}` : classes.field);
  field.dataset.iformKey = component.key ?? '';
  field.dataset.iformType = input.type;
  if (component.hidden) field.hidden = true;

  const labelText = ctx.text('label', component.label);
  const required = component.validate?.required && !component.disabled;
  if (labelText) {
    const label = el('label', classes.label);
    if (input.inlineLabel) {
      // checkbox first, label text after - the label wraps the control
      label.append(control.element, ' ', labelText);
    } else {
      label.htmlFor = (control.labelTarget ?? control.element).id || ctx.id;
      label.append(labelText);
    }
    if (required) label.append(' ', el('span', classes.required, '*'));
    field.append(label);
    if (!input.inlineLabel) field.append(control.element);
  } else {
    field.append(control.element);
  }

  const description = ctx.text('description', component.description);
  if (description) {
    field.append(el('small', classes.description, description));
  }
  const error = el('div', classes.error);
  error.setAttribute('role', 'alert');
  error.hidden = true;
  field.append(error);

  const handle: FieldHandle = {
    element: field,
    control,
    showError(message) {
      error.textContent = message ?? '';
      error.hidden = !message;
      field.classList.toggle(classes.invalid, !!message);
      (control.labelTarget ?? control.element).setAttribute('aria-invalid', message ? 'true' : 'false');
    },
  };
  return handle;
};
