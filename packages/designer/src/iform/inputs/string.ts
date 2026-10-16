import { el } from '../generator';
import { defineInput } from '../registry';

/** Text - a text field, or a text area when `multiline` (form.io's textarea). */
export default defineInput({
  type: 'string',
  aliases: ['textfield', 'textarea', 'text', 'email', 'url'],
  create(ctx) {
    const { component } = ctx;
    const multiline = component.multiline === true || component.type === 'textarea';
    const input = multiline ? el('textarea', ctx.classes.control) : el('input', ctx.classes.control);
    input.id = ctx.id;
    input.name = component.key ?? '';
    if (input instanceof HTMLTextAreaElement) {
      input.rows = typeof component.rows === 'number' ? component.rows : 3;
    } else {
      input.type = component.type === 'email' || component.type === 'url' ? component.type : 'text';
    }
    input.placeholder = ctx.text('placeholder', component.placeholder);
    input.addEventListener('input', ctx.changed);
    return {
      element: input,
      getValue: () => input.value,
      setValue: (value) => { input.value = value == null ? '' : String(value); },
      setDisabled: (disabled) => { input.disabled = disabled; },
      focus: () => input.focus(),
    };
  },
  isEmpty: (value) => value == null || value === '',
});
