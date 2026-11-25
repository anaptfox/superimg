//! Bundled Inter (OFL). Node reads the package files; edge and browser fetch
//! the same bytes relative to this module. Nothing loads until a caller asks.

import { cancellationError, isAbortError, raceSignal } from "./abort-signal.js";
import { assertNativeFont } from "./font-format.js";
import { installedAssetPaths } from "./package-assets.node-fallback.js";

export interface BundledInterFace {
  family: "Inter";
  weight: number;
  style: "normal";
  data: Uint8Array;
  mimeType: "font/ttf";
  request: string;
}

const FILES = [
  { weight: 400, file: "Inter-400.ttf" },
  { weight: 500, file: "Inter-500.ttf" },
  { weight: 700, file: "Inter-700.ttf" },
] as const;

interface NodeFsPromises {
  readFile(path: string): Promise<Uint8Array>;
}

async function nodeFs(): Promise<NodeFsPromises | undefined> {
  const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => NodeFsPromises } }).process;
  try {
    const builtin = proc?.getBuiltinModule?.("fs/promises");
    if (builtin) return builtin;
  } catch {
    // happy-dom and workers do not expose the Node builtin table.
  }
  return undefined;
}

function fileUrlPath(url: URL): string {
  let path = decodeURIComponent(url.pathname);
  if (/^\/[A-Za-z]:/.test(path)) path = path.slice(1);
  return path;
}

/** happy-dom rewrites `file:` URLs to `http://localhost/@fs/<abs-path>`. */
function filesystemPathFromUrl(url: URL): string | undefined {
  if (url.protocol === "file:") return fileUrlPath(url);
  const marker = "/@fs/";
  const index = url.pathname.indexOf(marker);
  if (index < 0) return undefined;
  let path = decodeURIComponent(url.pathname.slice(index + marker.length));
  if (!path.startsWith("/") && !/^[A-Za-z]:/.test(path)) path = `/${path}`;
  return path;
}

/**
 * Candidate locations from this module, walking ancestors.
 * Covers source (`src/rendering`), package `dist/fonts.js`, the assembled
 * `@foxworth/superimg/dist` tree, and a Vite-rewritten test module URL.
 */
export function bundledInterFontURLs(file: string): URL[] {
  const urls: URL[] = [];
  // This is runtime directory traversal, not a bundler asset reference to ".".
  // Keep a URL object as the base so downstream bundlers do not resolve a
  // directory import for `new URL(".", import.meta.url)`.
  let dir = new URL(import.meta.url);
  dir = new URL(".", dir);
  for (let depth = 0; depth < 12; depth += 1) {
    urls.push(new URL(`assets/fonts/${file}`, dir));
    urls.push(new URL(`packages/superimg-core/assets/fonts/${file}`, dir));
    const parent = new URL("../", dir);
    if (parent.href === dir.href) break;
    dir = parent;
  }
  return urls;
}

async function readCandidate(url: URL, fetcher: typeof globalThis.fetch, signal?: AbortSignal): Promise<Uint8Array | undefined> {
  const path = filesystemPathFromUrl(url);
  if (path) {
    const fs = await raceSignal(nodeFs(), signal);
    if (!fs) return undefined;
    try {
      const bytes = new Uint8Array(await raceSignal(fs.readFile(path), signal));
      return bytes.byteLength > 0 ? bytes : undefined;
    } catch (error) {
      if (isAbortError(error, signal)) throw cancellationError(error);
      return undefined;
    }
  }
  try {
    const response = await raceSignal(
      fetcher(url, signal !== undefined ? { signal } : undefined),
      signal,
    );
    if (!response.ok) return undefined;
    const bytes = new Uint8Array(await raceSignal(response.arrayBuffer(), signal));
    return bytes.byteLength > 0 ? bytes : undefined;
  } catch (error) {
    if (isAbortError(error, signal)) throw cancellationError(error);
    return undefined;
  }
}

async function readBundledFile(file: string, fetcher: typeof globalThis.fetch, signal?: AbortSignal): Promise<Uint8Array> {
  const installed = installedAssetPaths(`fonts/${file}`).map((path) => new URL(`file://${path}`));
  for (const url of [...bundledInterFontURLs(file), ...installed]) {
    const bytes = await readCandidate(url, fetcher, signal);
    if (bytes) {
      assertNativeFont(bytes);
      return bytes;
    }
  }
  throw new Error(`Bundled Inter face ${file} is not in the package assets.`);
}

let cachedFaces: BundledInterFace[] | undefined;
let pending: Promise<BundledInterFace[]> | undefined;

/** Weights 400, 500, and 700 of family "Inter". File reads happen on first call. */
export function loadBundledInter(options?: { fetch?: typeof globalThis.fetch; signal?: AbortSignal }): Promise<BundledInterFace[]> {
  if (options?.signal?.aborted === true) return Promise.reject(cancellationError());
  if (cachedFaces) return Promise.resolve(cachedFaces);
  if (!pending) {
    const fetcher = options?.fetch ?? globalThis.fetch;
    const signal = options?.signal;
    pending = (async () => {
      const faces: BundledInterFace[] = [];
      for (const entry of FILES) {
        const data = await readBundledFile(entry.file, fetcher, signal);
        faces.push({
          family: "Inter",
          weight: entry.weight,
          style: "normal",
          data,
          mimeType: "font/ttf",
          request: `bundled:Inter:${entry.weight}`,
        });
      }
      cachedFaces = faces;
      return faces;
    })().finally(() => {
      pending = undefined;
    });
  }
  return raceSignal(pending, options?.signal);
}

/** Test hook. */
export function clearBundledInterCache(): void {
  cachedFaces = undefined;
  pending = undefined;
}
