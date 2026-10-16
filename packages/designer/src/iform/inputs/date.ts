import { el } from '../generator';
import { defineInput } from '../registry';

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO instant -> the local "YYYY-MM-DDTHH:mm" a datetime-local input shows. */
function toLocalInput(value: unknown, withTime: boolean): string {
  if (value == null || value === '') return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return withTime ? `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
}

/**
 * Date - the browser's own date/time picker (no library). The value is an
 * ISO 8601 instant (UTC); a "YYYY-MM-DD" day with ui_hint "date" (or
 * `enableTime: false`).
 */
export default defineInput({
  type: 'Date',
  aliases: ['date', 'datetime'],
  uiHints: ['input', 'datetime', 'date'],
  create(ctx) {
    const { component } = ctx;
    const withTime = ctx.uiHint === 'date' ? false
      : ctx.uiHint === 'datetime' ? true
        : component.enableTime !== false && component.type !== 'date';
    const input = el('input', ctx.classes.control);
    input.id = ctx.id;
    input.name = component.key ?? '';
    input.type = withTime ? 'datetime-local' : 'date';
    input.addEventListener('change', ctx.changed);
    return {
      element: input,
      getValue: () => {
        if (!input.value) return null;
        return withTime ? new Date(input.value).toISOString() : input.value;
      },
      setValue: (value) => {
        // a plain day stays that day, whatever the time zone
        input.value = !withTime && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? value
          : toLocalInput(value, withTime);
      },
      setDisabled: (disabled) => { input.disabled = disabled; },
      focus: () => input.focus(),
    };
  },
  isEmpty: (value) => value == null || value === '',
});
