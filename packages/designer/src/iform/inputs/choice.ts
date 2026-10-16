/**
 * Choice controls - ui_hint "radio" (one button per choice) and "select" (a
 * drop-down) - for string, number and boolean values. The choices come from
 * the component's `values` ([{ label, value }] or plain values); a boolean
 * without values gets Yes / No. Usable as component types too (form.io's
 * radio / select), holding a string.
 */
import { el } from '../generator';
import { defineInput } from '../registry';
import type { IFormChoice, InputContext, InputControl } from '../types';

const CHOICE_TYPES = ['string', 'number', 'boolean'];

/** The component's choices, values coerced to its value type. */
export function choicesOf(ctx: Pick<InputContext, 'component' | 'valueType' | 't'>): IFormChoice[] {
  const raw = Array.isArray(ctx.component.values) ? ctx.component.values : [];
  const coerce = (value: unknown): IFormChoice['value'] => {
    if (ctx.valueType === 'number') return Number(value);
    if (ctx.valueType === 'boolean') return value === true || value === 'true';
    return String(value);
  };
  const choices = raw.map((entry) => entry && typeof entry === 'object'
    ? { label: String(entry.label ?? entry.value), value: coerce(entry.value) }
    : { label: String(entry), value: coerce(entry) });
  if (choices.length === 0 && ctx.valueType === 'boolean') {
    return [{ label: ctx.t('iform.choice.yes', 'Yes'), value: true }, { label: ctx.t('iform.choice.no', 'No'), value: false }];
  }
  return choices;
}

const indexOf = (choices: IFormChoice[], value: unknown) =>
  value == null || value === '' ? -1 : choices.findIndex((choice) => choice.value === value || String(choice.value) === String(value));

const translatedLabel = (ctx: InputContext, choice: IFormChoice) => ctx.text(`values.${String(choice.value)}`, choice.label);

export const radioInput = defineInput({
  type: 'radio',
  valueType: 'string',
  uiHints: ['radio'],
  forTypes: CHOICE_TYPES,
  create(ctx): InputControl {
    const choices = choicesOf(ctx);
    const group = el('div', 'iform-choices');
    group.id = ctx.id;
    group.setAttribute('role', 'radiogroup');
    const buttons = choices.map((choice, index) => {
      const label = el('label', 'iform-choice');
      const radio = el('input');
      radio.type = 'radio';
      radio.name = ctx.id;
      radio.value = String(index);
      radio.addEventListener('change', ctx.changed);
      label.append(radio, ' ', translatedLabel(ctx, choice));
      group.append(label);
      return radio;
    });
    return {
      element: group,
      labelTarget: buttons[0] ?? group,
      getValue: () => {
        const checked = buttons.findIndex((radio) => radio.checked);
        return checked < 0 ? null : choices[checked].value;
      },
      setValue: (value) => {
        const index = indexOf(choices, value);
        buttons.forEach((radio, i) => { radio.checked = i === index; });
      },
      setDisabled: (disabled) => buttons.forEach((radio) => { radio.disabled = disabled; }),
      focus: () => (buttons.find((radio) => radio.checked) ?? buttons[0])?.focus(),
    };
  },
  isEmpty: (value) => value == null,
});

export const selectInput = defineInput({
  type: 'select',
  valueType: 'string',
  uiHints: ['select'],
  forTypes: CHOICE_TYPES,
  create(ctx): InputControl {
    const choices = choicesOf(ctx);
    const select = el('select', ctx.classes.control);
    select.id = ctx.id;
    select.name = ctx.component.key ?? '';
    select.append(new Option(ctx.text('placeholder', ctx.component.placeholder) || ctx.t('iform.choice.none', '—'), ''));
    choices.forEach((choice, index) => select.append(new Option(translatedLabel(ctx, choice), String(index))));
    select.addEventListener('change', ctx.changed);
    return {
      element: select,
      getValue: () => (select.value === '' ? null : choices[Number(select.value)].value),
      setValue: (value) => {
        const index = indexOf(choices, value);
        select.value = index < 0 ? '' : String(index);
      },
      setDisabled: (disabled) => { select.disabled = disabled; },
      focus: () => select.focus(),
    };
  },
  isEmpty: (value) => value == null,
});
