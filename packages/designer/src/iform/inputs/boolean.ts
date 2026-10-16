import { el } from '../generator';
import { defineInput } from '../registry';

/** Yes / no - a checkbox; `required` means it must be checked. */
export default defineInput({
  type: 'boolean',
  aliases: ['checkbox'],
  inlineLabel: true,
  create(ctx) {
    const input = el('input');
    input.id = ctx.id;
    input.name = ctx.component.key ?? '';
    input.type = 'checkbox';
    input.addEventListener('change', ctx.changed);
    return {
      element: input,
      getValue: () => input.checked,
      setValue: (value) => { input.checked = value === true || value === 'true'; },
      setDisabled: (disabled) => { input.disabled = disabled; },
      focus: () => input.focus(),
    };
  },
  isEmpty: (value) => value !== true,
});
