import { el } from '../generator';
import { defineInput } from '../registry';
import { ElementRootPane } from '../rootpane';

/**
 * Panel - groups components under a title. A layout type: it has no value,
 * its children's values sit at the top level of the form data. Builds its
 * whole field itself (render) instead of going through the generator.
 */
export default defineInput({
  type: 'panel',
  aliases: ['fieldset', 'well'],
  layout: true,
  create() {
    throw new Error('panel is rendered by render()');
  },
  render(ctx) {
    const fieldset = el('fieldset', ctx.classes.panel);
    const title = ctx.text('label', (ctx.component.title as string | undefined) ?? ctx.component.label);
    if (title) fieldset.append(el('legend', ctx.classes.panelTitle, title));
    if (ctx.component.hidden) fieldset.hidden = true;
    ctx.renderChildren(ctx.component.components || [], new ElementRootPane(fieldset));
    return { element: fieldset, control: null, showError: () => {} };
  },
});
