import { el } from '../generator';
import { defineInput } from '../registry';

/** Number - empty is null; min / max are checked by the common rules. */
export default defineInput({
  type: 'number',
  aliases: ['integer', 'currency'],
  uiHints: ['input'],
  create(ctx) {
    const { component } = ctx;
    const input = el('input', ctx.classes.control);
    input.id = ctx.id;
    input.name = component.key ?? '';
    input.type = 'number';
    input.step = component.type === 'integer' ? '1' : 'any';
    if (typeof component.validate?.min === 'number') input.min = String(component.validate.min);
    if (typeof component.validate?.max === 'number') input.max = String(component.validate.max);
    input.placeholder = ctx.text('placeholder', component.placeholder);
    input.addEventListener('input', ctx.changed);
    return {
      element: input,
      // a partly typed number ("1e") reads as NaN - reported by validate()
      getValue: () => (input.value === '' && !input.validity.badInput ? null : input.valueAsNumber),
      setValue: (value) => { input.value = value == null || value === '' ? '' : String(value); },
      setDisabled: (disabled) => { input.disabled = disabled; },
      focus: () => input.focus(),
    };
  },
  validate: (value, component, t) => {
    if (typeof value === 'number' && Number.isNaN(value)) return t('iform.validation.number', 'Enter a number');
    if (component.type === 'integer' && typeof value === 'number' && !Number.isInteger(value)) {
      return t('iform.validation.integer', 'Enter a whole number');
    }
    return null;
  },
  isEmpty: (value) => value == null,
});
