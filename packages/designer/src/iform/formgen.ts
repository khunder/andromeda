/**
 * Forms generated from process variables: one field per variable, typed by
 * the variable's declared type (component types are the variable types).
 */
import type { IFormComponent, IFormDefinition } from './types';

/** A process variable as declared in the process (<bpmn:property> + itemDefinition structureRef). */
export interface FormVariable {
  name: string;
  /** string | number | boolean | object | Date | file */
  type: string;
  /** shown for context only - disabled field, never submitted as a change */
  readOnly?: boolean;
}

export const VARIABLE_TYPES = ['string', 'number', 'boolean', 'Date', 'object', 'file'];

/** "invoiceAmount" / "invoice_amount" -> "Invoice amount" */
export function labelFor(name: string): string {
  const words = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function componentForVariable({ name, type, readOnly = false }: FormVariable): IFormComponent {
  const component: IFormComponent = {
    type: VARIABLE_TYPES.includes(type) ? type : 'string',
    key: name,
    label: labelFor(name),
  };
  if (readOnly) component.disabled = true;
  if (type === 'object') component.label = `${component.label} (JSON)`;
  return component;
}

export function generateForm(variables: FormVariable[]): IFormDefinition {
  return { display: 'form', components: variables.map(componentForVariable) };
}

/** Value components by key, nested layouts included (form.io columns / table layouts too). */
export function formComponents(form: IFormDefinition | null | undefined): Map<string, IFormComponent> {
  const found = new Map<string, IFormComponent>();
  const walk = (components: unknown) => {
    if (!Array.isArray(components)) return;
    for (const component of components as IFormComponent[]) {
      if (!component || typeof component !== 'object') continue;
      const layout = Array.isArray(component.components) || component.input === false || component.type === 'button';
      if (!layout && component.key && !found.has(component.key)) found.set(component.key, component);
      walk(component.components);
      if (Array.isArray(component.columns)) (component.columns as any[]).forEach((column) => walk(column?.components));
      // `rows` is a number on a text area, a grid on a table
      if (Array.isArray(component.rows)) (component.rows as any[]).forEach((row) => Array.isArray(row) && row.forEach((cell: any) => walk(cell?.components)));
    }
  };
  walk(form?.components);
  return found;
}

/** Keys of a form's value fields; `editableOnly` leaves out disabled ones. */
export function formFieldKeys(form: IFormDefinition | null | undefined, { editableOnly = false } = {}): string[] {
  return [...formComponents(form).values()]
    .filter((component) => !(editableOnly && component.disabled))
    .map((component) => component.key!);
}
