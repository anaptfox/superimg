//! Bind persistent subjects to immutable design data. No clock, storage or approval policy.
import type { SubjectBinding, SubjectValue, VisualDefinition } from "../scene-types.js";

type VisualData<V> = V extends VisualDefinition<infer T> ? T : never;
type SubjectData<V> = VisualData<V> extends {
  design: unknown; state: unknown; performance: unknown;
} ? Exclude<keyof VisualData<V>, "design" | "state" | "performance"> extends never
  ? VisualData<V> : never : never;

export interface SubjectDesign {
  readonly of: VisualDefinition<never>;
  readonly design: unknown;
  /** An accepted revision reference from the author/host, not an automatically computed digest. */
  readonly revision: string;
  readonly appearanceId?: string;
  readonly styleRevision?: string;
}
export interface SubjectEntity<TDesign extends string = string> {
  readonly design: TDesign;
}
export type SubjectSample<V extends VisualDefinition<never>> = {
  readonly of: V;
  readonly entityId: string;
  readonly data: SubjectData<V>;
  readonly binding: SubjectBinding;
};
export interface SubjectSet<
  D extends Record<string, SubjectDesign>,
  E extends Record<string, SubjectEntity<keyof D & string>>,
> {
  sample<K extends keyof E & string>(
    entityId: K,
    input: Pick<SubjectData<D[E[K]["design"]]["of"]>, "state" | "performance">,
  ): SubjectSample<D[E[K]["design"]]["of"]>;
}

function text(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${path} must be a non-empty string`);
}

/** Strict JSON copy: no getters, prototypes, lossy undefined values, or cycles. */
function snapshot(value: unknown, path: string, active = new Set<object>()): SubjectValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object" || value === null) throw new TypeError(`${path} must be finite JSON data`);
  if (active.has(value)) throw new TypeError(`${path} contains a cycle`);
  const array = Array.isArray(value);
  if (!array && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    throw new TypeError(`${path} must be plain JSON data`);
  active.add(value);
  try {
    const entries: [string, SubjectValue][] = [];
    for (const key of Reflect.ownKeys(value)) {
      if (array && key === "length") continue;
      if (typeof key !== "string") throw new TypeError(`${path} cannot contain symbol keys`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!descriptor.enumerable || !("value" in descriptor)) throw new TypeError(`${path}.${key} must be a JSON value property`);
      if (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))
        throw new TypeError(`${path} cannot contain array properties`);
      entries.push([key, snapshot(descriptor.value, `${path}.${key}`, active)]);
    }
    if (array) {
      if (entries.length !== value.length) throw new TypeError(`${path} cannot contain sparse arrays`);
      return Object.freeze(entries.map(([, child]) => child));
    }
    return Object.freeze(Object.fromEntries(entries));
  } finally { active.delete(value); }
}

function sameValue(a: SubjectValue, b: SubjectValue): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.entries(a), right = Object.entries(b);
  return left.length === right.length && left.every(([key, value]) =>
    Object.hasOwn(b, key) && sameValue(value, (b as Record<string, SubjectValue>)[key]!));
}

/** Also used when resolving raw authored trees, so bypassing Instance() cannot bypass validation. */
export function validateSubjectBinding(props: {
  readonly binding?: SubjectBinding; readonly entityId?: string;
  readonly of: { readonly id: string }; readonly data: unknown;
}): SubjectBinding | undefined {
  if (props.binding === undefined) return undefined;
  const binding = props.binding;
  text(binding.entityId, "binding.entityId");
  text(binding.definitionId, "binding.definitionId");
  text(binding.designRevision, "binding.designRevision");
  if (binding.appearanceId !== undefined) text(binding.appearanceId, "binding.appearanceId");
  if (binding.styleRevision !== undefined) text(binding.styleRevision, "binding.styleRevision");
  if (binding.entityId !== props.entityId) throw new TypeError("Subject binding entityId does not match Instance.entityId");
  if (binding.definitionId !== props.of.id) throw new TypeError("Subject binding definitionId does not match Instance.of");
  const design = snapshot(binding.design, "binding.design");
  const data = props.data;
  if (!data || typeof data !== "object" || !("design" in data) ||
    !sameValue(design, snapshot(data.design, "Instance.data.design")))
    throw new TypeError("Subject binding design does not match Instance.data.design; sample a declared design instead");
  return Object.freeze({
    entityId: binding.entityId, definitionId: binding.definitionId,
    designRevision: binding.designRevision, design,
    ...(binding.appearanceId === undefined ? {} : { appearanceId: binding.appearanceId }),
    ...(binding.styleRevision === undefined ? {} : { styleRevision: binding.styleRevision }),
  });
}

/** Snapshot designs once, then independently snapshot state/performance for every occurrence. */
export function subjectSet<
  const D extends Record<string, SubjectDesign>,
  const E extends Record<string, SubjectEntity<keyof D & string>>,
>(input: {
  readonly designs: D & { readonly [K in keyof D]: { readonly design: SubjectData<D[K]["of"]>["design"] } };
  readonly entities: E;
}): SubjectSet<D, E> {
  const designs = new Map<string, SubjectDesign & { design: SubjectValue }>();
  for (const [id, design] of Object.entries(input.designs)) {
    text(id, "design id");
    if (design.of?.kind !== "@foxworth/superimg/visual" || typeof design.of.render !== "function")
      throw new TypeError(`Subject design ${id} requires a visual definition`);
    text(design.of.id, "visual.id");
    text(design.revision, "design.revision");
    if (design.appearanceId !== undefined) text(design.appearanceId, "design.appearanceId");
    if (design.styleRevision !== undefined) text(design.styleRevision, "design.styleRevision");
    designs.set(id, Object.freeze({ ...design, of: Object.freeze({ ...design.of }), design: snapshot(design.design, `designs.${id}`) }));
  }
  const entities = new Map<string, string>();
  for (const [id, entity] of Object.entries(input.entities)) {
    text(id, "entity id");
    if (!designs.has(entity.design)) throw new TypeError(`Unknown subject design ${entity.design}`);
    entities.set(id, entity.design);
  }
  return Object.freeze({
    sample(entityId, input) {
      const designId = entities.get(entityId);
      const definition = designId === undefined ? undefined : designs.get(designId);
      if (!definition) throw new TypeError(`Unknown subject entity ${entityId}`);
      const sampled = snapshot(input, `${entityId}.sample`);
      if (!sampled || typeof sampled !== "object" || Array.isArray(sampled)
        || Object.keys(sampled).length !== 2 || !Object.hasOwn(sampled, "state") || !Object.hasOwn(sampled, "performance"))
        throw new TypeError("Subject sample requires only state and performance; design is selected by the entity");
      const fields = sampled as { readonly state: SubjectValue; readonly performance: SubjectValue };
      const data = Object.freeze({
        design: definition.design,
        state: fields.state,
        performance: fields.performance,
      });
      const binding: SubjectBinding = Object.freeze({
        entityId, definitionId: definition.of.id, designRevision: definition.revision,
        design: definition.design,
        ...(definition.appearanceId === undefined ? {} : { appearanceId: definition.appearanceId }),
        ...(definition.styleRevision === undefined ? {} : { styleRevision: definition.styleRevision }),
      });
      // The mapped public signature relates each entity to its visual's data contract.
      return Object.freeze({ of: definition.of, entityId, data, binding }) as unknown as SubjectSample<D[E[typeof entityId]["design"]]["of"]>;
    },
  } satisfies SubjectSet<D, E>);
}
