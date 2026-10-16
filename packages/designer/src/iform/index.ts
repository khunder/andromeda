/**
 * iform - a small, dependency-free form generator for BPMN human tasks.
 *
 *   import { iform } from './iform';
 *   const form = iform.create(hostElementOrRootPane, definition, { data });
 *   form.on('change', (data) => ...);
 *   const data = await form.submit();     // rejects with IFormValidationError
 *
 * - Forms are JSON shaped like form.io's ({ components: [...] }); component
 *   types are the process variable types (string, number, boolean, Date,
 *   object, file) + panel, form.io names accepted as aliases.
 * - Input types live in ./inputs and register themselves (defineInput);
 *   iform.config.ts picks them and maps the markup onto the host's CSS.
 * - Every field is built by a generator (./generator.ts): replace it per
 *   form (options.generator), per type (InputDefinition.render), or for all
 *   forms (iform.generator).
 * - i18n: set iform.i18n to an object with t(key, fallback, params) - or a
 *   key -> text dictionary - and every label, hint and message goes through it.
 * - The form renders into a RootPane: a host element, or a pane the host
 *   application provides (its own native panel).
 * - `iform` holds no hidden global state: createIForm() makes independent
 *   roots, and a root can be embedded in other objects (app.iform = iform) -
 *   its functions don't depend on `this`.
 */
import defaultConfig from './iform.config';
import { IForm, IFormValidationError } from './form';
import { componentForVariable, formComponents, formFieldKeys, generateForm, labelFor } from './formgen';
import { defaultGenerator, el } from './generator';
import { defineInput, InputRegistry } from './registry';
import { ElementRootPane, toRootPane } from './rootpane';
import type { FieldGenerator, IFormConfig, IFormDefinition, IFormI18n, IFormOptions, InputDefinition, RootPane } from './types';

export interface IFormRoot {
  readonly config: IFormConfig;
  readonly registry: InputRegistry;
  /** translations - see the header */
  i18n: IFormI18n | undefined;
  /** the field generator every form uses unless told otherwise */
  generator: FieldGenerator;
  create(host: HTMLElement | RootPane, definition: IFormDefinition, options?: IFormOptions): IForm;
  register(definition: InputDefinition): void;
  generateForm: typeof generateForm;
  componentForVariable: typeof componentForVariable;
  formComponents: typeof formComponents;
  formFieldKeys: typeof formFieldKeys;
}

export function createIForm(config: IFormConfig = defaultConfig): IFormRoot {
  const registry = new InputRegistry();
  config.inputs.forEach((input) => registry.register(input));

  const root: IFormRoot = {
    config,
    registry,
    i18n: undefined,
    generator: defaultGenerator,
    create(host, definition, options = {}) {
      return new IForm(toRootPane(host), definition, {
        registry,
        classes: { ...config.classes, ...options.classes },
        generator: root.generator,
        i18nPrefix: config.i18nPrefix,
        i18n: () => root.i18n,
      }, options);
    },
    register: (definition) => registry.register(definition),
    generateForm,
    componentForVariable,
    formComponents,
    formFieldKeys,
  };
  return root;
}

/** The application's iform root. */
export const iform = createIForm();

export {
  IForm, IFormValidationError, ElementRootPane, defaultGenerator, defineInput, el, labelFor,
  componentForVariable, formComponents, formFieldKeys, generateForm,
};
export { isPickedFile, type IFormFileValue } from './inputs/file';
export type { FormVariable } from './formgen';
export type * from './types';
