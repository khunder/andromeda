import { el } from '../generator';
import { defineInput } from '../registry';

/**
 * Yes / no - a checkbox (ui_hint "checkbox"), or a toggle (ui_hint "switch");
 * `required` means it must be on.
 */
export default defineInput({
  type: 'boolean',
  aliases: ['checkbox'],
  uiHints: ['checkbox', 'switch'],
  inlineLabel: true,
  create(ctx) {
    const input = el('input', ctx.uiHint === 'switch' ? 'iform-switch' : '');
    input.id = ctx.id;
    input.name = ctx.component.key ?? '';
    input.type = 'checkbox';
    if (ctx.uiHint === 'switch') input.setAttribute('role', 'switch');
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
