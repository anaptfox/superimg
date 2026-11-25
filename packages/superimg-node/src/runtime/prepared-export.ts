//! A native, host-owned preparation. No portable reference or authority token.
import { parseDuration } from "@superimg/core";
import { createHash } from "node:crypto";
import { analyzeExportMediaValue, createExportBundle, staticCollectionEntries } from "@superimg/core/runtime";
import { createNodeRuntimeAdapter, preparedState, type NodeRuntimeAdapterOptions } from "./adapter.js";
import type { ExportableMedia, ExportOptions, RuntimeRenditionCoordinates } from "@superimg/types";

/** Copy first-party values while retaining native authored functions. Closures remain author-owned. */
function own<T>(value: T, seen = new Set<unknown>()): T {
  if (value instanceof Uint8Array) return value.slice() as T;
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) throw new TypeError("Prepared input must not contain cycles");
  seen.add(value);
  const result = Array.isArray(value) ? value.map(v => own(v, seen)) : Object.fromEntries(Object.entries(value).map(([k,v]) => [k, own(v, seen)]));
  seen.delete(value);
  return Object.freeze(result) as T;
}
const key = (c: RuntimeRenditionCoordinates) => JSON.stringify([c.entryId ?? null, c.variantId, c.editionId, c.renditionId]);

/**
 * Provider-free: hosts supply an already captured static collection or a media value.
 * Declared resources and resolved inputs are retained; arbitrary script/network/closure
 * effects are not frozen. Native handles never grant invocation authority.
 */
export async function prepareNodeMediaExport(input: ExportableMedia, requested: ExportOptions, adapterOptions: NodeRuntimeAdapterOptions = {}) {
  const media = own(input);
  if (media.kind === "collection" && !Array.isArray(media.entries)) throw new TypeError("Prepare requires a static collection snapshot; execute providers explicitly in the host");
  if (requested.for.length > 64) throw new RangeError("Preparation supports at most 64 delivery targets");
  if (media.kind === "collection" && Array.isArray(media.entries) && media.entries.length > 256) throw new RangeError("Preparation supports at most 256 static entries");
  if (!requested.for.length) throw new TypeError("At least one export target is required");
  const clean = { ...requested };
  delete clean.signal; delete clean.runtime; delete clean.onProgress;
  const options = own(clean);
  if (requested.signal?.aborted) throw requested.signal.reason ?? new Error("Preparation cancelled");
  // Fetch once per URL during this preparation. Subsequent sample/export never refetch.
  const maxFetchedBytes = adapterOptions.maxFetchedBytes ?? 64 * 1024 * 1024;
  if (!Number.isFinite(maxFetchedBytes) || maxFetchedBytes <= 0) {
    throw new RangeError("maxFetchedBytes must be a positive finite number");
  }
  const responses = new Map<string, Promise<{ bytes: Uint8Array; status: number; headers: Headers }>>();
  let fetchedBytes = 0;
  const fetcher = adapterOptions.fetch ?? globalThis.fetch;
  const adapter = createNodeRuntimeAdapter({ ...adapterOptions, fetch: async (url, init) => {
    const name = String(url);
    let cached = responses.get(name);
    if (!cached) { cached = (async () => { const r = await fetcher(url, init); const bytes = new Uint8Array(await r.arrayBuffer()); fetchedBytes += bytes.byteLength; if (fetchedBytes > maxFetchedBytes) throw new RangeError(`Prepared fetched resources exceed ${maxFetchedBytes} bytes`); return { bytes, status: r.status, headers: r.headers }; })(); responses.set(name, cached); }
    const r = await cached;
    return new Response(r.bytes.slice(), { status: r.status, headers: r.headers });
  }});
  const entries = media.kind === "collection" ? staticCollectionEntries(media) : null;
  let disposed = false;
  let active = false;
  let disposePreflight: (() => void | Promise<void>) | undefined;
  try {
    const analysis = await analyzeExportMediaValue(media, { ...options, ...(requested.signal ? { signal: requested.signal } : {}) }, adapter.capabilities, entries);
    if (analysis.coordinates.length * options.for.length > 1024) throw new RangeError("Preparation exceeds 1024 renditions");
    const preflight = await adapter.preflight({ operation: "export", programDigest: analysis.programDigest, media, options: { ...options, ...(requested.signal ? { signal: requested.signal } : {}) }, selections: analysis.selections, ...(entries ? { entries } : {}) });
    disposePreflight = preflight.dispose?.bind(preflight);
    const findings = [...analysis.findings, ...preflight.findings];
    if (findings.some(f => f.severity === "error")) throw new Error(findings.filter(f => f.severity === "error").map(f => `${f.code}: ${f.message}`).join("\n"));
    const state = preparedState(preflight);
    const plan = state.exportPlan;
    if (!plan) throw new Error("Missing prepared export matrix");
    // Force lazy projections now: retained resources must not inherit request cancellation.
    const detach = (r: typeof state.resources) => Object.freeze({ ...r, assetUrls: r.assetUrls, assetMetadata: r.assetMetadata, fontCss: r.fontCss, ...(r.audio ? { audio: r.audio } : {}) });
    const resources = detach(state.resources);
    const renditions = new Map([...state.renditions ?? []].map(([k,v]) => [k, { ...v, resources: detach(v.resources ?? state.resources) }]));
    const retained = { ...preflight, prepared: { ...state, resources, renditions } };
    const matrix = Object.freeze(plan.renditions.map(r => {
      const definition = renditions.get(key(r.coordinates))!.definition;
      const fps = definition.config?.fps ?? 30;
      const totalFrames = !definition.animated ? 1 : definition.composition?.schedule.totalFrames ?? Math.ceil(parseDuration(definition.config?.duration, "duration", fps) * fps);
      return Object.freeze({ coordinates: Object.freeze({ ...r.coordinates }), canvas: Object.freeze({ ...r.canvas }), clock: Object.freeze({ fps, totalFrames }), format: r.format, path: r.relativePath });
    }));
    const digest = createHash("sha256").update(JSON.stringify({ program: analysis.programDigest, matrix, options, assets: [...renditions.values()].flatMap(r => r.resources.assets), fonts: [...renditions.values()].flatMap(r => r.resources.fonts) })).digest("hex");
    const run = async <T>(fn: () => Promise<T>): Promise<T> => {
      if (disposed) throw new Error("Prepared export disposed");
      if (active) throw new Error("Prepared export already in use");
      active = true;
      try { return await fn(); } finally { active = false; }
    };
    return Object.freeze({
      digest, matrix, findings: Object.freeze(findings),
      coverage: Object.freeze({ inputs: "declared-resources" as const, visual: "unreviewed" as const }),
      sample(selection: RuntimeRenditionCoordinates, at: NonNullable<ExportOptions["at"]>, as: "html" | "png" = "png", control: Pick<ExportOptions, "signal"> = {}) {
        return run(async () => {
          const rendition = plan.renditions.find(r => key(r.coordinates) === key(selection));
          if (!rendition) throw new Error("Rendition was not prepared");
          const resolved = renditions.get(key(rendition.coordinates));
          if (!resolved) throw new Error("Missing retained rendition");
          return adapter.render({ operation: "render", programDigest: analysis.programDigest, media,
            options: { as, at, size: rendition.canvas, ...control }, selection: { media: resolved.definition, data: resolved.data, coordinates: rendition.coordinates },
            preflight: { ...retained, prepared: { resources: resolved.resources, render: resolved } },
          });
        });
      },
      export(control: Pick<ExportOptions, "signal" | "onProgress"> = {}) {
        return run(async () => {
          const output = await adapter.exportMedia({ operation: "export", programDigest: analysis.programDigest, media, options: { ...options, ...control }, selections: analysis.selections, preflight: retained, ...(entries ? { entries } : {}) });
          try { return createExportBundle({ programDigest: analysis.programDigest, expectedCoordinates: analysis.coordinates, output, assets: [...renditions.values()].flatMap(r => r.resources.assets), fonts: [...renditions.values()].flatMap(r => r.resources.fonts) }); }
          catch (e) { await Promise.all(output.artifacts.map(a => a.backing?.dispose())); throw e; }
        });
      },
      async dispose() {
        if (disposed) return;
        if (active) throw new Error("Cannot dispose prepared export while in use");
        disposed = true; renditions.clear(); responses.clear();
        await disposePreflight?.(); await adapter.dispose();
      },
    });
  } catch (e) { await disposePreflight?.(); await adapter.dispose(); throw e; }
}

export type PreparedNodeMediaExport = Awaited<ReturnType<typeof prepareNodeMediaExport>>;
