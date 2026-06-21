//! SuperImg Batch Types
//! Co-located `export const batch` convention for build-time fan-out.
//! A template module optionally exports `batch` (built with `defineBatch`) to
//! generate many outputs from one template — no separate loader file.

import type { AnyTemplateModule } from "./index.js";

/**
 * A single entry in a batch render job.
 * `slug` is REQUIRED and EXPLICIT — it becomes the output suffix
 * (e.g. `og-<slug>.png`) and the host's typed media key.
 */
export interface BatchEntry<TData = Record<string, unknown>> {
  /** Filename-safe slug for this entry (output: `<stem>-<slug>.<ext>`) */
  slug: string;
  /** Data passed into the template for this entry */
  data: TData;
  /** Optional width override for this entry */
  width?: number;
  /** Optional height override for this entry */
  height?: number;
  /** Optional duration override (video/gif only) */
  duration?: number;
  /** Optional fps override (video/gif only) */
  fps?: number;
}

/** Build-time data generator: returns one entry per output. */
export type BatchProvider<TData = Record<string, unknown>> =
  () => BatchEntry<TData>[] | Promise<BatchEntry<TData>[]>;

/**
 * Type a co-located `batch` export against its template.
 *
 * `TData` flows from the template value — change the template's `sample`
 * shape and the `data:` sites below type-error. The template argument is
 * inference-only; at runtime the provider is returned unchanged.
 *
 * Put any server/data imports *inside* the provider with `await import(...)`
 * so the client player bundle (which imports the template) tree-shakes them out.
 *
 * @example
 * ```typescript
 * // og.image.ts
 * import { defineImage, defineBatch } from "superimg";
 *
 * const template = defineImage({ sample: { title: "Hi" }, config: { width: 1200, height: 630 }, render });
 * export default template;
 *
 * export const batch = defineBatch(template, async () => {
 *   const { getPosts } = await import("../content");
 *   return (await getPosts()).map(p => ({ slug: p.slug, sample: { title: p.title } }));
 * });
 * ```
 */
export function defineBatch<TData>(
  _template: AnyTemplateModule<TData>,
  provider: BatchProvider<TData>,
): BatchProvider<TData> {
  return provider;
}
