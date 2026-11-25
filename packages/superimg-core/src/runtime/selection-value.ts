import type { DeterministicMediaDefinition, JsonObject } from "@superimg/types";

/** Pure and self-contained: compiler projections may embed this function. */
export function selectMediaDefinition(
  media: DeterministicMediaDefinition<JsonObject>,
  options: { readonly data?: JsonObject; readonly variantId?: string; readonly editionId?: string; readonly entryData?: JsonObject } = {},
): DeterministicMediaDefinition<JsonObject> {
  const variantId = options.variantId ?? "default";
  const patch = variantId === "default" ? undefined : media.variants?.[variantId];
  if (variantId !== "default" && patch === undefined) throw new TypeError(`Unknown media variant ${JSON.stringify(variantId)}`);
  const editionId = options.editionId ?? "default";
  const edition = editionId === "default" ? undefined : media.editions?.[editionId];
  if (editionId !== "default" && edition === undefined) throw new TypeError(`Unknown media edition ${JSON.stringify(editionId)}`);
  const sample = Object.freeze({
    ...(options.entryData ?? { ...(media.sample ?? {}), ...(options.data ?? {}) }),
    ...(patch ?? {}),
  });
  return {
    ...media, sample,
    ...(edition === undefined ? {} : {
      render: edition.render ?? media.render,
      config: { ...media.config, width: edition.size.width, height: edition.size.height },
    }),
  } as DeterministicMediaDefinition<JsonObject>;
}
