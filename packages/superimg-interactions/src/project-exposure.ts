import {
  projectInteractions,
  type CompiledInteractions,
  type HandlesOf,
  type InteractionDefinitions,
  type InteractionMode,
  type ProjectionSelection,
} from "@foxworth/boundary";

/** Preserve the selected aliases and literal modes through the native shorthand. */
type Selections<Definitions extends InteractionDefinitions, Exposure> = {
  readonly [Alias in keyof Exposure as Alias extends keyof Definitions
    ? Exposure[Alias] extends undefined ? never : Alias
    : never]: ProjectionSelection<
      HandlesOf<Definitions>[Alias & keyof Definitions],
      readonly [Extract<Exposure[Alias], InteractionMode>]
    >;
};

export function projectExposure<
  Definitions extends InteractionDefinitions,
  const Exposure extends Readonly<Partial<Record<keyof Definitions, InteractionMode>>>,
>(compiled: CompiledInteractions<Definitions>, expose: Exposure) {
  const selections: Record<string, ProjectionSelection> = {};
  // Iterate the native aliases: omitted values never widen the caller surface.
  for (const alias of Object.keys(compiled.handles)) {
    const mode = expose[alias];
    if (mode !== undefined) {
      selections[alias] = { interaction: compiled.handles[alias]!, modes: [mode] };
    }
  }
  return projectInteractions(compiled, selections as Selections<Definitions, Exposure>);
}
