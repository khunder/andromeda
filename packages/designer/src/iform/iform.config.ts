/**
 * iform configuration.
 *
 * - inputs: importing an input module registers its type (defineInput) - add
 *   your own module here, or one with the same `type` to replace a built-in.
 * - classes: the CSS classes of the generated markup - mapped onto the
 *   application's existing styles (.property-group etc. in style.css).
 * - i18nPrefix: translation keys of component texts: <prefix><key>.label
 */
import type { IFormConfig } from './types';
import stringInput from './inputs/string';
import numberInput from './inputs/number';
import booleanInput from './inputs/boolean';
import dateInput from './inputs/date';
import objectInput from './inputs/object';
import fileInput from './inputs/file';
import panelInput from './inputs/panel';
import { radioInput, selectInput } from './inputs/choice';

const config: IFormConfig = {
  // ui_hint controls (radio, select) register like any input - by their hints
  inputs: [stringInput, numberInput, booleanInput, dateInput, objectInput, fileInput, panelInput, radioInput, selectInput],
  classes: {
    root: 'iform',
    field: 'property-group iform-field',
    fieldInline: 'iform-inline',
    label: '',
    control: '',
    description: 'property-hint',
    error: 'iform-error',
    invalid: 'iform-invalid',
    required: 'iform-required',
    panel: 'iform-panel',
    panelTitle: '',
  },
  i18nPrefix: 'iform.field.',
};

export default config;
