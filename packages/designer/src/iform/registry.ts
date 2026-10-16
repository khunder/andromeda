/**
 * Input type registry.
 *
 * Auto registration: an input module declares itself with defineInput(); just
 * importing the module (iform.config.ts imports the built-in ones) makes the
 * type available to every iform. A root can also register() its own inputs -
 * they win over auto-registered ones of the same name, so any built-in type
 * can be replaced per application.
 */
import type { InputDefinition } from './types';

const autoRegistered = new Map<string, InputDefinition>();

function addTo(map: Map<string, InputDefinition>, definition: InputDefinition): void {
  for (const name of [definition.type, ...(definition.aliases || [])]) {
    map.set(name, definition);
  }
}

/** Declares an input type - registered for every iform as soon as the module is loaded. */
export function defineInput<T extends InputDefinition>(definition: T): T {
  addTo(autoRegistered, definition);
  return definition;
}

export class InputRegistry {
  private readonly own = new Map<string, InputDefinition>();

  /** Adds or replaces an input type (and its aliases) for this registry only. */
  register(definition: InputDefinition): void {
    addTo(this.own, definition);
  }

  resolve(type: string): InputDefinition | undefined {
    return this.own.get(type) ?? autoRegistered.get(type);
  }

  /** Every known type name, aliases excluded. */
  types(): string[] {
    const all = new Map(autoRegistered);
    this.own.forEach((definition, name) => all.set(name, definition));
    return [...new Set([...all.values()].map((definition) => definition.type))];
  }
}
