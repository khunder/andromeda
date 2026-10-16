/**
 * Input type registry.
 *
 * Auto registration: an input module declares itself with defineInput(); just
 * importing the module (iform.config.ts imports the built-in ones) makes the
 * type available to every iform. A root can also register() its own inputs -
 * they win over auto-registered ones of the same name, so any built-in type
 * can be replaced per application.
 *
 * Inputs are found by component type (string, checkbox...) and, when the
 * component has a ui_hint, by hint (radio, select...) among the inputs that
 * can edit its value type.
 */
import type { IFormComponent, InputDefinition } from './types';

interface Table {
  types: Map<string, InputDefinition>;
  hints: Map<string, InputDefinition[]>;
}

const newTable = (): Table => ({ types: new Map(), hints: new Map() });

const autoRegistered = newTable();

function addTo(table: Table, definition: InputDefinition): void {
  for (const name of [definition.type, ...(definition.aliases || [])]) {
    table.types.set(name, definition);
  }
  for (const hint of definition.uiHints || []) {
    // newest first - a later registration overrides for the same types
    table.hints.set(hint, [definition, ...(table.hints.get(hint) || []).filter((other) => other.type !== definition.type)]);
  }
}

/** A definition edits the types in forTypes - without it, only its own value type. */
const accepts = (definition: InputDefinition, valueType: string) =>
  (definition.forTypes ?? [definition.valueType ?? definition.type]).includes(valueType);

/** Declares an input type - registered for every iform as soon as the module is loaded. */
export function defineInput<T extends InputDefinition>(definition: T): T {
  addTo(autoRegistered, definition);
  return definition;
}

export interface ResolvedInput {
  input: InputDefinition;
  /** string, number, boolean, Date, object, file - or the layout type */
  valueType: string;
  /** the hint the input was picked for; undefined when ui_hint wasn't usable */
  uiHint: string | undefined;
}

export class InputRegistry {
  private readonly own = newTable();

  /** Adds or replaces an input type (and its aliases / hints) for this registry only. */
  register(definition: InputDefinition): void {
    addTo(this.own, definition);
  }

  /** The input of a component type (aliases included). */
  resolve(type: string): InputDefinition | undefined {
    return this.own.types.get(type) ?? autoRegistered.types.get(type);
  }

  private hintCandidates(hint: string): InputDefinition[] {
    return [...(this.own.hints.get(hint) || []), ...(autoRegistered.hints.get(hint) || [])];
  }

  /**
   * The input for a component: its type's input, unless ui_hint names one
   * that can edit the value type. An unusable hint falls back to the type's
   * input (uiHint undefined) - the caller may warn.
   */
  resolveComponent(component: Pick<IFormComponent, 'type' | 'ui_hint'>): ResolvedInput | undefined {
    const base = this.resolve(component.type);
    if (!base) return undefined;
    const valueType = base.valueType ?? base.type;
    const hint = typeof component.ui_hint === 'string' ? component.ui_hint : undefined;
    if (!hint) return { input: base, valueType, uiHint: undefined };
    if (base.uiHints?.includes(hint)) return { input: base, valueType, uiHint: hint };
    const input = this.hintCandidates(hint).find((candidate) => accepts(candidate, valueType));
    return input ? { input, valueType, uiHint: hint } : { input: base, valueType, uiHint: undefined };
  }

  /** The ui_hint values usable for a value type - its own control's first (the default). */
  hintsFor(valueType: string): string[] {
    const base = this.resolve(valueType);
    const hints = new Set(base?.uiHints || []);
    for (const table of [this.own, autoRegistered]) {
      table.hints.forEach((definitions, hint) => {
        if (definitions.some((definition) => definition !== base && accepts(definition, valueType))) hints.add(hint);
      });
    }
    return [...hints];
  }

  /** Every known type name, aliases excluded. */
  types(): string[] {
    const all = new Map(autoRegistered.types);
    this.own.types.forEach((definition, name) => all.set(name, definition));
    return [...new Set([...all.values()].map((definition) => definition.type))];
  }
}
