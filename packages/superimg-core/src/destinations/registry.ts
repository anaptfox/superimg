import type { DestinationDefinition } from "./types.js";
import { validateDestinationCatalog } from "./validate.js";

/** Validate and freeze a destination list into an ID-addressable registry. */
export function createDestinationRegistry<const T extends readonly DestinationDefinition[]>(
  definitions: T,
): Readonly<Record<T[number]["id"], T[number]>> {
  validateDestinationCatalog(definitions);
  const registry = Object.create(null) as Record<string, T[number]>;
  for (const definition of definitions) registry[definition.id] = deepFreeze(definition);
  return Object.freeze(registry) as Readonly<Record<T[number]["id"], T[number]>>;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
