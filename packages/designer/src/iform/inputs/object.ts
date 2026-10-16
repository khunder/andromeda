import { el } from '../generator';
import { defineInput } from '../registry';

/** What an object field holds while its text isn't valid JSON. */
export class InvalidJson {
  constructor(readonly text: string, readonly reason: string) {}
}

/** Object - edited as JSON in a text area. */
export default defineInput({
  type: 'object',
  aliases: ['json'],
  uiHints: ['textarea'],
  create(ctx) {
    const { component } = ctx;
    const input = el('textarea', ctx.classes.control);
    input.id = ctx.id;
    input.name = component.key ?? '';
    input.rows = typeof component.rows === 'number' ? component.rows : 5;
    input.spellcheck = false;
    input.style.fontFamily = 'ui-monospace, SFMono-Regular, Consolas, monospace';
    input.placeholder = ctx.text('placeholder', component.placeholder ?? '{ }');
    input.addEventListener('input', ctx.changed);
    return {
      element: input,
      getValue: () => {
        const text = input.value.trim();
        if (!text) return null;
        try {
          return JSON.parse(text);
        } catch (error) {
          return new InvalidJson(text, error instanceof Error ? error.message : String(error));
        }
      },
      setValue: (value) => { input.value = value == null ? '' : JSON.stringify(value, null, 2); },
      setDisabled: (disabled) => { input.disabled = disabled; },
      focus: () => input.focus(),
    };
  },
  validate: (value, _component, t) =>
    value instanceof InvalidJson ? t('iform.validation.json', 'Invalid JSON: {{reason}}', { reason: value.reason }) : null,
  isEmpty: (value) => value == null,
});
