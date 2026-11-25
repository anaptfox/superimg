//! Font-bytes registry.
//!
//! Google declarations still download CSS2 (legacy UA for TTF). Local
//! declarations resolve from bytes, http(s), or filesystem paths with no
//! Google request. Bundled Inter is loaded separately by `resolveRuntimeFonts`.

import {
  fontDeclarationIssue,
  isGoogleFontDeclaration,
  type FontDeclaration,
  type FontInput,
} from "@superimg/types";
import { decodeWoff1ToSfnt, isWoff1, isWoff2 } from "@superimg/stdlib/svg/woff";
import { assertNativeFont } from "./font-format.js";
import { fontMimeType } from "./font-css.js";
import { decodeWoff2IdentityToSfnt } from "./woff2.js";
import { loadBundledInter } from "./bundled-inter.js";
import { sha256Hex } from "../ir/pure/sha256.js";
import { cancellationError, isAbortError, raceSignal } from "./abort-signal.js";

export interface ResolvedFont {
  family: string;
  weight: number;
  style: "normal" | "italic";
  data: Uint8Array;
  mimeType?: "font/ttf" | "font/otf" | "font/woff" | "font/woff2" | "font/collection";
  /** Stable label stored on frozen metadata (`request`). */
  request?: string;
}

export interface FontResolveOptions {
  signal?: AbortSignal;
  /** Native SVG needs SFNT; browser capture also accepts WOFF containers. */
  format?: "native" | "web";
  fetch?: typeof globalThis.fetch;
  /** Directory used for relative file paths. Defaults to the process cwd. */
  sourceDir?: string;
  /**
   * Default faces. An array replaces bundled Inter. `false` disables it.
   * Omit to load bundled Inter.
   */
  defaultFonts?: readonly FontDeclaration[] | false;
}

interface ResolveContext {
  readonly options: FontResolveOptions;
  readonly bytes: Map<string, Promise<Uint8Array>>;
  readonly specs: Map<string, Promise<ResolvedFont[]>>;
}

interface ParsedSpec {
  /** Display family name with spaces ("Playfair Display"). */
  family: string;
  /** Original Google-Fonts query fragment ("Playfair+Display:wght@400;700"). */
  query: string;
}

// A browser without web-font container support receives raw TrueType.
// Chrome 40 receives WOFF, which resvg cannot decode. Validate the returned
// bytes as well: provider content negotiation is not a format guarantee.
const LEGACY_UA = "Mozilla/4.0";

/** Explicitly seeded native buffers are shared across hosts and formats. */
const seededBytes = new Map<string, Promise<Uint8Array>>();
/** Network caches belong to the fetch capability and negotiated format. */
let caches = new WeakMap<typeof globalThis.fetch, Map<string, ResolveContext>>();

function context(options: FontResolveOptions): ResolveContext {
  options.signal?.throwIfAborted();
  // Cancellation belongs to one request. Only explicit seeds can be reused
  // without also inheriting another request's fetch capability or signal.
  if (options.signal) return { options, bytes: new Map(seededBytes), specs: new Map() };
  const fetcher = options.fetch ?? globalThis.fetch;
  let formats = caches.get(fetcher);
  if (!formats) {
    formats = new Map();
    caches.set(fetcher, formats);
  }
  const key = options.format ?? "native";
  let cached = formats.get(key);
  if (!cached) {
    cached = { options: { ...options, fetch: fetcher }, bytes: new Map(), specs: new Map() };
    formats.set(key, cached);
  }
  return cached;
}

/** Unpack WOFF containers before native SFNT checks. Web format keeps WOFF bytes. */
function acceptFontBytes(bytes: Uint8Array, format: FontResolveOptions["format"]): Uint8Array {
  if (format === "web") {
    if (!isWoff1(bytes) && !isWoff2(bytes)) assertNativeFont(bytes);
    return bytes;
  }
  const unpacked = isWoff1(bytes)
    ? decodeWoff1ToSfnt(bytes) ?? bytes
    : isWoff2(bytes)
      ? decodeWoff2IdentityToSfnt(bytes) ?? bytes
      : bytes;
  assertNativeFont(unpacked);
  return unpacked;
}

function parseSpec(spec: string): ParsedSpec {
  const familyPart = spec.split(":")[0] ?? spec;
  return {
    family: familyPart.replace(/\+/g, " ").trim(),
    query: spec.trim(),
  };
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  errorLabel: string,
  fetcher: typeof globalThis.fetch,
): Promise<Response> {
  const attempts = 4;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetcher(url, init);
      if (!res.ok) {
        throw new Error(`${errorLabel} (${res.status}).`);
      }
      return res;
    } catch (e) {
      last = e;
      if (isAbortError(e, init.signal ?? undefined)) throw cancellationError(e);
      if (i < attempts - 1) {
        await raceSignal(new Promise((resolve) => setTimeout(resolve, 150 * 2 ** i)), init.signal ?? undefined);
      }
    }
  }
  throw last instanceof Error ? last : new Error(errorLabel);
}

async function fetchCss(spec: ParsedSpec, ctx: ResolveContext): Promise<string> {
  const { signal } = ctx.options;
  const url = `https://fonts.googleapis.com/css2?family=${spec.query}&display=swap`;
  const res = await fetchWithRetry(
    url,
    {
      ...(ctx.options.format === "web" ? {} : { headers: { "User-Agent": LEGACY_UA } }),
      ...(signal !== undefined ? { signal } : {}),
    },
    `Failed to fetch font CSS for "${spec.query}"`,
    ctx.options.fetch ?? globalThis.fetch,
  );
  return raceSignal(res.text(), signal);
}

function fetchBytes(url: string, ctx: ResolveContext): Promise<Uint8Array> {
  const { signal } = ctx.options;
  let pending = seededBytes.get(url) ?? ctx.bytes.get(url);
  if (!pending) {
    pending = (async () => {
      const res = await fetchWithRetry(
        url,
        { ...(signal !== undefined ? { signal } : {}) },
        `Failed to fetch font "${url}"`,
        ctx.options.fetch ?? globalThis.fetch,
      );
      const fetched = new Uint8Array(await raceSignal(res.arrayBuffer(), signal));
      return acceptFontBytes(fetched, ctx.options.format);
    })();
    pending.catch(() => ctx.bytes.delete(url));
    ctx.bytes.set(url, pending);
  }
  return pending;
}

/** Parse @font-face blocks from a Google Fonts CSS2 response. */
function parseFaces(css: string, fallbackFamily: string): {
  family: string;
  weight: number;
  style: "normal" | "italic";
  url: string;
}[] {
  const faces: { family: string; weight: number; style: "normal" | "italic"; url: string }[] = [];
  const blockRe = /@font-face\s*{([^}]*)}/g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(css)) !== null) {
    const body = block[1] ?? "";
    const family = /font-family:\s*['"]?([^;'"]+)['"]?/.exec(body)?.[1]?.trim() ?? fallbackFamily;
    const weight = Number.parseInt(/font-weight:\s*(\d+)/.exec(body)?.[1] ?? "400", 10);
    const style = (/font-style:\s*(italic)/.exec(body) ? "italic" : "normal") as
      | "normal"
      | "italic";
    const url = /src:\s*url\(([^)]+)\)/.exec(body)?.[1]?.replace(/['"]/g, "");
    if (url) faces.push({ family, weight, style, url });
  }
  return faces;
}

async function resolveSpec(spec: string, ctx: ResolveContext): Promise<ResolvedFont[]> {
  let pending = ctx.specs.get(spec);
  if (!pending) {
    pending = (async () => {
      const parsed = parseSpec(spec);
      const css = await fetchCss(parsed, ctx);
      const faces = parseFaces(css, parsed.family);
      return Promise.all(
        faces.map(async (f) => {
          const data = await fetchBytes(f.url, ctx);
          return { family: f.family, weight: f.weight, style: f.style, data, mimeType: fontMimeType(data) };
        }),
      );
    })();
    pending.catch(() => ctx.specs.delete(spec));
    ctx.specs.set(spec, pending);
  }
  return pending;
}

export interface FontRegistry {
  /** Resolve font declarations to buffers (cached). Bare strings throw. */
  resolve(inputs: readonly FontInput[], opts?: FontResolveOptions): Promise<ResolvedFont[]>;
  /** Pre-seed buffers by source URL (e.g. from R2 / bundled assets in a Worker). */
  seed(entries: { url: string; data: Uint8Array }[]): void;
  /** Drop all caches. */
  clear(): void;
}

export const fonts: FontRegistry = {
  async resolve(inputs, opts) {
    const issue = inputs.map(fontDeclarationIssue).find((entry) => entry !== undefined);
    if (issue) throw new TypeError(`${issue.code}: ${issue.message}`);
    const ctx = context(opts ?? {});
    const groups = await Promise.all(inputs.map((input) => resolveInput(input, ctx)));
    return groups.flat();
  },
  seed(entries) {
    const unpacked = entries.map((entry) => ({ url: entry.url, data: acceptFontBytes(entry.data, "native") }));
    for (const { url, data } of unpacked) {
      seededBytes.set(url, Promise.resolve(data.slice()));
    }
  },
  clear() {
    seededBytes.clear();
    caches = new WeakMap();
  },
};

/** Convenience: resolve declarations straight to the `Uint8Array[]` resvg wants. */
export async function resolveFontBuffers(
  inputs: readonly FontInput[],
  opts?: FontResolveOptions,
): Promise<Uint8Array[]> {
  const resolved = await fonts.resolve(inputs, opts);
  return resolved.map((f) => f.data);
}

export interface RuntimeFontNote {
  readonly code: string;
  readonly message: string;
}

export interface RuntimeFontResolution {
  readonly faces: readonly ResolvedFont[];
  readonly errors: readonly RuntimeFontNote[];
  readonly warnings: readonly RuntimeFontNote[];
}

/**
 * Author faces plus bundled Inter. An author face whose family is Inter
 * replaces the bundled faces for that family. Invalid entries become errors
 * instead of throwing, so one bad declaration does not drop the other faces.
 */
export async function resolveRuntimeFonts(
  inputs: readonly unknown[] | undefined,
  opts?: FontResolveOptions,
): Promise<RuntimeFontResolution> {
  const errors: RuntimeFontNote[] = [];
  const warnings: RuntimeFontNote[] = [];
  const valid: FontInput[] = [];
  for (const input of inputs ?? []) {
    const issue = fontDeclarationIssue(input);
    if (issue) errors.push(issue);
    else valid.push(input as FontInput);
  }
  let author: ResolvedFont[] = [];
  if (valid.length > 0) {
    try {
      author = await fonts.resolve(valid, opts);
    } catch (error) {
      if (isAbortError(error, opts?.signal)) throw cancellationError(error);
      errors.push({
        code: "FONT_RESOLUTION_FAILED",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  let bundled: ResolvedFont[] = [];
  if (opts?.defaultFonts !== false) {
    try {
      bundled = opts?.defaultFonts
        ? await fonts.resolve(opts.defaultFonts, opts)
        : await loadBundledInter({
          ...(opts?.fetch !== undefined ? { fetch: opts.fetch } : {}),
          ...(opts?.signal !== undefined ? { signal: opts.signal } : {}),
        });
    } catch (error) {
      if (isAbortError(error, opts?.signal)) throw cancellationError(error);
      const message = error instanceof Error ? error.message : String(error);
      if (opts?.defaultFonts) {
        errors.push({
          code: "FONT_RESOLUTION_FAILED",
          message: `Could not read host default fonts: ${message}`,
        });
      } else {
        warnings.push({
          code: "DEFAULT_FONT_UNAVAILABLE",
          message: `Bundled Inter is unavailable in this runtime: ${message}`,
        });
      }
    }
  }
  return { faces: overlayFontFaces(bundled, author), errors, warnings };
}

/** Author faces replace bundled faces that share a family name. */
export function overlayFontFaces(base: readonly ResolvedFont[], author: readonly ResolvedFont[]): ResolvedFont[] {
  const families = new Set(author.map((face) => face.family.trim().toLowerCase()));
  return [
    ...base.filter((face) => !families.has(face.family.trim().toLowerCase())),
    ...author,
  ];
}

/** Stable string for Media IR / replay jobs. Google specs stay unchanged. */
export function fontIrToken(input: FontInput): string {
  if (isGoogleFontDeclaration(input)) return input.spec.trim();
  if (typeof input.src === "string") return input.src.trim();
  const bytes = input.src instanceof Uint8Array ? input.src : new Uint8Array(input.src);
  const weight = input.weight ?? 400;
  const style = input.style ?? "normal";
  return `embedded:${input.family.trim()}:${weight}:${style}:${sha256Hex(bytes)}`;
}

/** Google specs only, for Chromium `<link>` tags. */
export function googleFontSpecs(inputs: readonly unknown[] | undefined): string[] {
  const specs: string[] = [];
  for (const input of inputs ?? []) {
    if (isGoogleFontDeclaration(input)) specs.push(input.spec.trim());
  }
  return specs;
}

async function resolveInput(input: FontInput, ctx: ResolveContext): Promise<ResolvedFont[]> {
  if (isGoogleFontDeclaration(input)) {
    const faces = await resolveSpec(input.spec, ctx);
    return faces.map((face) => ({ ...face, request: input.spec.trim() }));
  }
  return [await resolveLocal(input, ctx)];
}

async function resolveLocal(declaration: FontDeclaration, ctx: ResolveContext): Promise<ResolvedFont> {
  const data = acceptFontBytes(await localBytes(declaration, ctx), ctx.options.format);
  const weight = declaration.weight ?? 400;
  const style = declaration.style ?? "normal";
  return {
    family: declaration.family.trim(),
    weight,
    style,
    data,
    mimeType: fontMimeType(data),
    request: typeof declaration.src === "string" ? declaration.src : `bytes:${declaration.family.trim()}:${weight}:${style}`,
  };
}

async function localBytes(declaration: FontDeclaration, ctx: ResolveContext): Promise<Uint8Array> {
  const src = declaration.src;
  if (src instanceof ArrayBuffer) return new Uint8Array(src.slice(0));
  if (src instanceof Uint8Array) return src.slice();
  const text = src.trim();
  if (/^https?:\/\//i.test(text)) return fetchBytes(text, ctx);
  const path = await filesystemPath(text, ctx.options.sourceDir);
  return readFontFile(path);
}

async function filesystemPath(src: string, sourceDir: string | undefined): Promise<string> {
  if (src.startsWith("file:")) return fileUrlPath(new URL(src));
  if (src.startsWith("/") || /^[A-Za-z]:[\\/]/.test(src)) return src;
  const base = sourceDir && sourceDir.trim().length > 0 ? sourceDir : cwd();
  return joinPath(base, src);
}

function cwd(): string {
  const proc = (globalThis as { process?: { cwd?: () => string } }).process;
  return proc?.cwd?.() ?? ".";
}

function joinPath(dir: string, rel: string): string {
  const slash = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  const base = dir.endsWith("/") || dir.endsWith("\\") ? dir.slice(0, -1) : dir;
  return `${base}${slash}${rel}`;
}

function fileUrlPath(url: URL): string {
  let path = decodeURIComponent(url.pathname);
  if (/^\/[A-Za-z]:/.test(path)) path = path.slice(1);
  return path;
}

async function readFontFile(path: string): Promise<Uint8Array> {
  const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => { readFile(path: string): Promise<Uint8Array> } } }).process;
  const fs = proc?.getBuiltinModule?.("fs/promises");
  if (!fs) throw new Error(`Cannot read font file ${JSON.stringify(path)} on this runtime.`);
  return new Uint8Array(await fs.readFile(path));
}
