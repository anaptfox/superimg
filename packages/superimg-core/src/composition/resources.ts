import { bytesDataUrl } from "../shared/base64.js";
//! Job-owned child resource bindings for retained composition.
//!
//! The map is deliberately a WeakMap: resources belong to a prepared program
//! occurrence, never to the reusable authored Program or its source media.

import type { AssetDeclaration, AssetMeta, CompositionMedia } from "@superimg/types";

export interface PreparedChildResources {
  /** URLs keyed by the child's local `config.assets` key. */
  readonly urls: Readonly<Record<string, string>>;
  /** Metadata the host supplied while resolving the URLs. */
  readonly assets: Readonly<Record<string, AssetMeta>>;
}

export type CompositionResourceKind = "asset" | "font" | "audio";

export function validateCompositionSourceBase(sourceBase: string | URL, path: string): URL {
  let base: URL;
  try { base = sourceBase instanceof URL ? new URL(sourceBase.href) : new URL(sourceBase); }
  catch { throw new TypeError(`composition: ${path}: sourceBase must be an absolute HTTP(S) or file URL`); }
  if (!(base.protocol === "http:" || base.protocol === "https:" || base.protocol === "file:")) {
    throw new TypeError(`composition: ${path}: sourceBase must be an absolute HTTP(S) or file URL`);
  }
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  return base;
}

/** Resolve an authored relative source with an explicitly supplied child base. */
export function resolveCompositionSource(source: string, sourceBase: string | URL | undefined, path: string, name: string, kind: CompositionResourceKind): string {
  if (/^(?:data:|https?:|file:)/i.test(source) || source.startsWith("/") || /^[A-Za-z]:[\\/]/.test(source)) return source;
  if (!sourceBase) throw new TypeError(`composition: ${path}: ${kind} ${JSON.stringify(name)} has a relative source; provide an explicit sourceBase for this child occurrence or use an absolute URL/bytes`);
  let base: URL;
  try { base = sourceBase instanceof URL ? new URL(sourceBase.href) : new URL(sourceBase); }
  catch { throw new TypeError(`composition: ${path}: sourceBase for ${kind} ${JSON.stringify(name)} must be an absolute HTTP(S) or file URL`); }
  if (!(["http:", "https:", "file:"].includes(base.protocol))) throw new TypeError(`composition: ${path}: sourceBase for ${kind} ${JSON.stringify(name)} must be an absolute HTTP(S) or file URL`);
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  try {
    const resolved = new URL(source, base);
    if (resolved.protocol !== base.protocol) throw new Error("protocol changed");
    return resolved.href;
  } catch {
    throw new TypeError(`composition: ${path}: could not resolve ${kind} ${JSON.stringify(name)} against its explicit sourceBase`);
  }
}

const resourcesByMedia = new WeakMap<object, PreparedChildResources>();

export function compositionAssetNamespace(path: string, name: string): string {
  return `${path}/${encodeURIComponent(name)}`;
}


function absoluteResourceUrl(value: string | URL, path: string, name: string): string {
  let url: URL;
  try {
    url = value instanceof URL ? value : new URL(value);
  } catch {
    throw new TypeError(`composition: ${path}: asset "${name}" must use an absolute HTTP(S)/file URL or explicit bytes; relative paths need an explicit sourceBase`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:" && url.protocol !== "file:") {
    throw new TypeError(`composition: ${path}: asset "${name}" must use an absolute HTTP(S)/file URL or explicit bytes`);
  }
  return url.href;
}

/** Portable declarations can render without host state: bytes become data URLs and HTTP(S) stays absolute. */
export function portableChildResourcesFor(
  media: CompositionMedia,
  path: string,
  sourceBase?: string | URL,
): PreparedChildResources {
  const urls: Record<string, string> = {};
  for (const [name, declaration] of Object.entries(media.config?.assets ?? {}) as [string, AssetDeclaration][]) {
    if ("bytes" in declaration) {
      if (!(declaration.bytes instanceof Uint8Array) || declaration.bytes.byteLength === 0 || typeof declaration.mimeType !== "string" || declaration.mimeType.trim() === "") {
        throw new TypeError(`composition: ${path}: asset "${name}" bytes declaration requires non-empty Uint8Array bytes and mimeType`);
      }
      urls[name] = bytesDataUrl(declaration.bytes, declaration.mimeType);
    } else {
      const source = resolveCompositionSource(String(declaration.url), sourceBase, path, name, "asset");
      urls[name] = absoluteResourceUrl(source, path, name);
    }
  }
  return Object.freeze({ urls: Object.freeze(urls), assets: Object.freeze({}) });
}

export function bindPreparedChildResources(
  media: CompositionMedia,
  resources: PreparedChildResources,
): CompositionMedia {
  resourcesByMedia.set(media, resources);
  return media;
}

export function preparedChildResourcesFor(
  media: CompositionMedia,
): PreparedChildResources | undefined {
  return resourcesByMedia.get(media);
}
