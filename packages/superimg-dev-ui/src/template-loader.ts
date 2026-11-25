//! Dev UI template bundle loading (projection-aware and sourcemap-aware).

import type { TemplateBundle } from "@superimg/types";
import type { SuperImgErrorJSON } from "@superimg/types";
import { showErrorOverlay } from "./error-overlay";

/** Sentinel: distinguishes "structured error already shown" from "bundle endpoint unavailable". */
const STRUCTURED_BUNDLE_ERROR = Symbol("STRUCTURED_BUNDLE_ERROR");

export class StructuredBundleError extends Error {
  readonly [STRUCTURED_BUNDLE_ERROR] = true;
  constructor(message: string, readonly details?: SuperImgErrorJSON) {
    super(message);
    this.name = "StructuredBundleError";
  }
}

export function isStructuredBundleError(err: unknown): err is StructuredBundleError {
  return (
    !!err &&
    typeof err === "object" &&
    (err as Record<symbol, unknown>)[STRUCTURED_BUNDLE_ERROR] === true
  );
}

/**
 * Translate a template URL to its sourcemap-aware bundle URL.
 *  - `/api/template`              → `/api/template-bundle`   (single-video mode)
 *  - `/api/videos/<name>/template`→ `/api/videos/<name>/template-bundle`
 *
 * Returns null when the URL doesn't match a known server bundle endpoint.
 */
export function bundleUrlFor(path: string): string | null {
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const queryIndex = withoutHash.indexOf("?");
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  if (/\/api\/template$/.test(pathname)) return `${pathname.replace(/\/api\/template$/, "/api/template-bundle")}${query}${hash}`;
  if (/\/api\/videos\/[^/]+\/template$/.test(pathname)) return `${pathname.replace(/\/template$/, "/template-bundle")}${query}${hash}`;
  return null;
}

export type BundleState = {
  current: TemplateBundle | null;
};

export type LoadTemplateOptions = {
  /** Home thumbnails/hover should not take over the page. Default true. */
  showOverlay?: boolean;
  /** Manual Reload invalidates the server's compiled source cache. */
  fresh?: boolean;
  /** Live preview owns cancellation; independent thumbnails omit this. */
  signal?: AbortSignal;
};

const templateSources = new WeakMap<object, NonNullable<TemplateBundle["source"]>>();
type DevTemplateBundle = TemplateBundle & { readonly generation?: number; readonly moduleUrl?: string };
const templateBundles = new WeakMap<object, DevTemplateBundle>();
export function templateBundle(template: unknown): DevTemplateBundle | undefined {
  return typeof template === "object" && template !== null ? templateBundles.get(template) : undefined;
}
/** Config failures preserve the same structured diagnostic as bundle failures. */
export async function readConfigResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.error) {
    const error = body?.error;
    throw new StructuredBundleError(error?.message ?? `Config request failed with HTTP ${response.status}`, error && typeof error === "object" ? error : undefined);
  }
  if (!body || typeof body !== "object") throw new StructuredBundleError("Config response is not an object");
  return body as T;
}
export function templateSource(template: unknown): TemplateBundle["source"] {
  return typeof template === "object" && template !== null ? templateSources.get(template) : undefined;
}

/**
 * Load the template bundle as an atomic snapshot — code + sourceMap + sourceFile —
 * via the appropriate `*-bundle` endpoint. Imports the code through a Blob URL
 * so the parsed sourcemap remains accessible for runtime error enrichment.
 *
 * Behavior:
 *  - 200: Blob-import the code, store the parsed sourceMap.
 *  - 500 with `{ error: SuperImgErrorJSON }`: render the overlay and abort.
 *  - Any unavailable or malformed bundle: fail closed without importing raw source.
 */
interface TemplateLoaderHost {
  fetch: typeof fetch;
  importCode: (code: string) => Promise<{ default?: unknown }>;
  importUrl?: (url: string) => Promise<{ default?: unknown }>;
  showError: typeof showErrorOverlay;
}

/** Browser host seams also permit deterministic transport/import race tests. */
export function createTemplateLoader(host: TemplateLoaderHost) {
  return async function loadTemplate(
    path: string,
    bundleState: BundleState,
    options?: LoadTemplateOptions,
  ): Promise<unknown> {
    const checkpoint = () => options?.signal?.throwIfAborted();
    checkpoint();
    const bundleUrl = bundleUrlFor(path);
    if (!bundleUrl) {
      bundleState.current = null;
      throw new StructuredBundleError(`Unsupported template bundle endpoint: ${path}`);
    }

    let res: Response;
    try {
      const requestUrl = new URL(bundleUrl, "http://superimg.invalid");
      requestUrl.searchParams.set("t", String(Date.now()));
      if (options?.fresh) requestUrl.searchParams.set("reload", "1");
      res = await host.fetch(`${requestUrl.pathname}${requestUrl.search}${requestUrl.hash}`, { signal: options?.signal ?? null });
      checkpoint();
    } catch (error) {
      checkpoint();
      bundleState.current = null;
      throw new StructuredBundleError(
        `Template bundle request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      checkpoint();
      bundleState.current = null;
      if (body?.error) {
        if (options?.showOverlay !== false) {
          host.showError(body.error);
        }
        throw new StructuredBundleError(body.error.message ?? "Template load failed", body.error);
      }
      throw new StructuredBundleError(
        `Template bundle request failed with HTTP ${res.status}`,
      );
    }

    const bundle = (await res.json()) as DevTemplateBundle;
    checkpoint();
    const hasCompanions = (bundle.outputs?.filter(output => output.type === "chunk").length ?? 0) > 1;
    if (hasCompanions && (!bundle.moduleUrl || !host.importUrl)) {
      throw new StructuredBundleError("This preview host cannot load companion module files.");
    }
    const mod = hasCompanions ? await host.importUrl!(bundle.moduleUrl!) : await host.importCode(bundle.code);
    checkpoint();
    const template = mod.default ?? mod;
    // Native imports share this object with the media's resource list. Point
    // them at this preview host's immutable files instead of capture's origin.
    if (template && typeof template === "object") {
      const media = (template as { kind?: string; media?: unknown }).kind === "collection" ? (template as { media?: unknown }).media : template;
      const sets = (media as { config?: { nativeModuleSets?: Array<{ identity: string; moduleUrl?: string; bridgeUrl?: string }> } })?.config?.nativeModuleSets ?? [];
      for (const set of sets) {
        const prefix = `https://superimg-native.invalid/${set.identity}/`;
        for (const key of ["moduleUrl", "bridgeUrl"] as const) {
          const url = set[key];
          if (url?.startsWith(prefix)) set[key] = `/api/template-output/${set.identity}/${url.slice(prefix.length)}`;
        }
      }
    }
    bundleState.current = bundle;
    if (typeof template === "object" && template !== null) {
      templateBundles.set(template, bundle);
      if (bundle.source) templateSources.set(template, bundle.source);
    }
    return template;
  };
}

export const loadTemplate = createTemplateLoader({
  fetch: (input, init) => fetch(input, init),
  showError: showErrorOverlay,
  importUrl: (url) => import(/* @vite-ignore */ url),
  async importCode(code) {
    const blob = new Blob([code], { type: "application/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    try {
      return await import(/* @vite-ignore */ blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  },
});
