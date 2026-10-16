// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createIForm, generateForm, formFieldKeys, IFormValidationError, defaultGenerator, type IFormDefinition, type RootPane } from './index';

// the Expense Approval task form, saved with form.io type names
const EXPENSE_FORM: IFormDefinition = {
  display: 'form',
  components: [
    { type: 'number', key: 'amount', label: 'Amount', input: true, disabled: true },
    { type: 'checkbox', key: 'approved', label: 'Approve this expense', input: true },
    { type: 'textarea', key: 'comment', label: 'Comment', input: true, rows: 3 },
  ],
};

let host: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
});

describe('iform rendering and data', () => {
  it('renders form.io type names through aliases, with the values given', () => {
    const iform = createIForm();
    const form = iform.create(host, EXPENSE_FORM, { data: { amount: 120, approved: false, comment: 'ok' } });
    expect(host.querySelector<HTMLInputElement>('input[type=number]')!.disabled).toBe(true);
    expect(host.querySelector('input[type=checkbox]')).not.toBeNull();
    expect(host.querySelector<HTMLTextAreaElement>('textarea')!.rows).toBe(3);
    expect(form.data).toEqual({ amount: 120, approved: false, comment: 'ok' });
    expect(form.editableKeys()).toEqual(['approved', 'comment']);
  });

  it('reads edits and emits change', () => {
    const form = createIForm().create(host, EXPENSE_FORM);
    const seen: unknown[] = [];
    form.on('change', (data) => seen.push(data.comment));
    const textarea = host.querySelector('textarea')!;
    textarea.value = 'looks fine';
    textarea.dispatchEvent(new Event('input'));
    expect(seen).toEqual(['looks fine']);
  });

  it('renders every variable type from a generated form', () => {
    const form = createIForm().create(host, generateForm([
      { name: 'title', type: 'string' }, { name: 'count', type: 'number' }, { name: 'done', type: 'boolean' },
      { name: 'due', type: 'Date' }, { name: 'meta', type: 'object' }, { name: 'scan', type: 'file' },
    ]), { data: { due: '2026-11-01T09:00:00.000Z', meta: { a: 1 } } });
    expect([...host.querySelectorAll('input, textarea')].map((element) => (element as HTMLInputElement).type))
      .toEqual(['text', 'number', 'checkbox', 'datetime-local', 'textarea', 'file']);
    expect(form.data.due).toBe('2026-11-01T09:00:00.000Z');
    expect(form.data.meta).toEqual({ a: 1 });
  });

  it('keeps a stored file reference until another file is picked', () => {
    const ref = { kind: 'file', fileName: 'invoice.pdf', sha256: 'abc' };
    const form = createIForm().create(host, generateForm([{ name: 'scan', type: 'file' }]), { data: { scan: ref } });
    expect(form.data.scan).toBe(ref);
    expect(host.textContent).toContain('invoice.pdf');
  });

  it('nests panels - their fields are top-level data', () => {
    const form = createIForm().create(host, {
      components: [{ type: 'panel', title: 'Details', components: [{ type: 'string', key: 'city', label: 'City' }] }],
    }, { data: { city: 'Tunis' } });
    expect(host.querySelector('fieldset legend')!.textContent).toBe('Details');
    expect(form.data).toEqual({ city: 'Tunis' });
  });
});

describe('ui_hint', () => {
  it('lists the controls that fit each type, the default first', () => {
    const iform = createIForm();
    expect(iform.uiHintsFor('string')).toEqual(['input', 'textarea', 'radio', 'select']);
    expect(iform.uiHintsFor('number')).toEqual(['input', 'radio', 'select']);
    expect(iform.uiHintsFor('boolean')).toEqual(['checkbox', 'switch', 'radio', 'select']);
    expect(iform.uiHintsFor('Date')).toEqual(['input', 'datetime', 'date']);
    expect(iform.uiHintsFor('file')).toEqual(['input']);
  });

  it('renders radio and select, keeping the value type', () => {
    const form = createIForm().create(host, {
      components: [
        { type: 'string', key: 'level', ui_hint: 'radio', values: [{ label: 'Low', value: 'low' }, { label: 'High', value: 'high' }] },
        { type: 'number', key: 'priority', ui_hint: 'select', values: [1, 2, 3] },
        { type: 'boolean', key: 'urgent', ui_hint: 'radio' },
      ],
    }, { data: { level: 'high', priority: 2, urgent: false } });
    expect(host.querySelectorAll('input[type=radio]')).toHaveLength(4); // 2 levels + yes/no
    expect(host.querySelector('select')!.options).toHaveLength(4); // "—" + 3
    expect(form.data).toEqual({ level: 'high', priority: 2, urgent: false });

    const low = host.querySelector<HTMLInputElement>('[data-iform-key="level"] input[value="0"]')!;
    low.checked = true;
    low.dispatchEvent(new Event('change'));
    const select = host.querySelector('select')!;
    select.value = '2';
    expect(form.data).toMatchObject({ level: 'low', priority: 3 });
    expect(typeof form.data.priority).toBe('number');
  });

  it('switch, textarea and date-only hints change the control', () => {
    const form = createIForm().create(host, {
      components: [
        { type: 'boolean', key: 'on', ui_hint: 'switch' },
        { type: 'string', key: 'note', ui_hint: 'textarea' },
        { type: 'Date', key: 'day', ui_hint: 'date' },
      ],
    }, { data: { day: '2026-11-01' } });
    expect(host.querySelector('input[role=switch]')).not.toBeNull();
    expect(host.querySelector('textarea')).not.toBeNull();
    expect(host.querySelector<HTMLInputElement>('input[type=date]')!.value).toBe('2026-11-01');
    expect(form.data.day).toBe('2026-11-01');
  });

  it('falls back to the default control for a hint that does not fit the type', () => {
    createIForm().create(host, { components: [{ type: 'file', key: 'scan', ui_hint: 'radio' }] });
    expect(host.querySelector('input[type=file]')).not.toBeNull();
    expect(host.querySelector('input[type=radio]')).toBeNull();
  });

  it('validates a required choice', () => {
    const form = createIForm().create(host, { components: [{ type: 'string', key: 'pick', ui_hint: 'select', values: ['a'], validate: { required: true } }] });
    expect(form.validate()).toHaveLength(1);
  });

  it('is set by the variable picker and gets placeholder choices', () => {
    const [field] = generateForm([{ name: 'level', type: 'string', uiHint: 'radio' }]).components;
    expect(field).toMatchObject({ type: 'string', ui_hint: 'radio' });
    expect(field.values).toHaveLength(2);
    expect(generateForm([{ name: 'ok', type: 'boolean', uiHint: 'radio' }]).components[0].values).toBeUndefined();
  });

  it('lets a custom input add a hint for a type', () => {
    const iform = createIForm();
    iform.register({
      type: 'stars', uiHints: ['stars'], forTypes: ['number'],
      create: (ctx) => {
        const span = document.createElement('span');
        span.id = ctx.id;
        let value: unknown = null;
        return { element: span, getValue: () => value, setValue: (next) => { value = next; span.textContent = '★'.repeat(Number(next) || 0); }, setDisabled: () => {} };
      },
    });
    expect(iform.uiHintsFor('number')).toContain('stars');
    iform.create(host, { components: [{ type: 'number', key: 'rating', ui_hint: 'stars' }] }, { data: { rating: 3 } });
    expect(host.textContent).toContain('★★★');
  });
});

describe('iform validation', () => {
  const definition: IFormDefinition = {
    components: [
      { type: 'string', key: 'code', label: 'Code', validate: { required: true, pattern: '[A-Z]{3}' } },
      { type: 'number', key: 'qty', label: 'Qty', validate: { min: 1 } },
      { type: 'object', key: 'meta', label: 'Meta' },
    ],
  };

  it('reports required, pattern, min and invalid JSON', async () => {
    const form = createIForm().create(host, definition, { data: { qty: 0 } });
    host.querySelector<HTMLTextAreaElement>('textarea')!.value = '{ broken';
    await expect(form.submit()).rejects.toBeInstanceOf(IFormValidationError);
    expect(form.validate().map((error) => error.key)).toEqual(['code', 'qty', 'meta']);
    expect(host.querySelectorAll('.iform-invalid')).toHaveLength(3);

    form.setData({ code: 'abc', qty: 2, meta: { ok: true } });
    expect(form.validate().map((error) => error.message)).toEqual(['Invalid format']);
    form.setData({ code: 'ABC', qty: 2, meta: { ok: true } });
    await expect(form.submit()).resolves.toEqual({ code: 'ABC', qty: 2, meta: { ok: true } });
  });

  it('skips disabled fields', () => {
    const form = createIForm().create(host, { components: [{ type: 'string', key: 'x', disabled: true, validate: { required: true } }] });
    expect(form.validate()).toEqual([]);
  });
});

describe('iform customisation', () => {
  it('translates with iform.i18n - t() or a dictionary', () => {
    const iform = createIForm();
    iform.i18n = { 'iform.field.comment.label': 'Commentaire', 'iform.validation.required': 'Obligatoire' };
    const form = iform.create(host, { components: [{ type: 'string', key: 'comment', label: 'Comment', validate: { required: true } }] });
    expect(host.querySelector('label')!.textContent).toContain('Commentaire');
    expect(form.validate()[0].message).toBe('Obligatoire');

    iform.i18n = { t: (key, fallback) => (key.endsWith('.label') ? fallback.toUpperCase() : key) };
    iform.create(host, { components: [{ type: 'string', key: 'comment', label: 'Comment' }] });
    expect(host.querySelector('label')!.textContent).toBe('COMMENT');
  });

  it('lets a root register its own input type, replacing a built-in', () => {
    const iform = createIForm();
    iform.register({
      type: 'boolean',
      aliases: ['checkbox'],
      create: (ctx) => {
        const select = document.createElement('select');
        select.id = ctx.id;
        select.append(new Option('No', 'no'), new Option('Yes', 'yes'));
        return {
          element: select,
          getValue: () => select.value === 'yes',
          setValue: (value) => { select.value = value ? 'yes' : 'no'; },
          setDisabled: (disabled) => { select.disabled = disabled; },
        };
      },
    });
    const form = iform.create(host, EXPENSE_FORM, { data: { approved: true } });
    expect(host.querySelector('select')!.value).toBe('yes');
    expect(form.data.approved).toBe(true);
    // other roots keep the built-in checkbox
    createIForm().create(document.body.appendChild(document.createElement('div')), EXPENSE_FORM);
    expect(document.querySelectorAll('input[type=checkbox]')).toHaveLength(1);
  });

  it('uses a custom generator, wrapping the default one', () => {
    const iform = createIForm();
    iform.generator = (input, ctx) => {
      const field = defaultGenerator(input, ctx);
      field.element.dataset.custom = 'yes';
      return field;
    };
    iform.create(host, EXPENSE_FORM);
    expect(host.querySelectorAll('[data-custom="yes"]')).toHaveLength(3);
  });

  it('renders into a root pane the host provides, and maps classes onto host styles', () => {
    const appended: HTMLElement[] = [];
    const element = document.createElement('section');
    const pane: RootPane = { element, append: (node) => { appended.push(node); element.append(node); }, clear: () => element.replaceChildren() };
    createIForm().create(pane, EXPENSE_FORM, { classes: { field: 'host-field' } });
    expect(appended).toHaveLength(3);
    expect(element.querySelectorAll('.host-field')).toHaveLength(3);
  });

  it('can be embedded in another object - functions do not depend on `this`', () => {
    const app = { forms: createIForm() };
    const { create } = app.forms;
    expect(() => create(host, EXPENSE_FORM)).not.toThrow();
  });
});

describe('form generation', () => {
  it('types fields by the variable type and marks read-only ones', () => {
    const form = generateForm([
      { name: 'invoiceAmount', type: 'number', readOnly: true },
      { name: 'approved', type: 'boolean' },
      { name: 'odd', type: 'unknown' },
    ]);
    expect(form.components.map((component) => [component.type, component.key, component.label, !!component.disabled])).toEqual([
      ['number', 'invoiceAmount', 'Invoice amount', true],
      ['boolean', 'approved', 'Approved', false],
      ['string', 'odd', 'Odd', false],
    ]);
    expect(formFieldKeys(form, { editableOnly: true })).toEqual(['approved', 'odd']);
  });
});
