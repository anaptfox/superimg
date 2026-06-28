//! Font-bytes registry for the resvg lane.
//!
//! resvg needs raw font buffers (TTF/OTF), not Google-Fonts URL strings. This
//! resolves the same `config.fonts` shorthand the Chromium path loads via
//! `<link>` tags ("Inter:wght@400;700") into `{ family, weight, style, data }`
//! buffers, fetched once and cached. Pure fetch — Worker-safe, no node builtins.

export interface ResolvedFont {
  family: string;
  weight: number;
  style: "normal" | "italic";
  data: Uint8Array;
}

interface ParsedSpec {
  /** Display family name with spaces ("Playfair Display"). */
  family: string;
  /** Original Google-Fonts query fragment ("Playfair+Display:wght@400;700"). */
  query: string;
}

// Requesting as an old browser makes Google Fonts serve TrueType (.ttf)
// instead of woff2 — resvg-wasm parses ttf/otf, not woff2.
const LEGACY_UA =
  "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0 Safari/537.36";

/** url → bytes, deduped across concurrent resolves. */
const byteCache = new Map<string, Promise<Uint8Array>>();
/** spec → resolved fonts, so repeated configs don't re-fetch CSS. */
const specCache = new Map<string, Promise<ResolvedFont[]>>();

function parseSpec(spec: string): ParsedSpec {
  const familyPart = spec.split(":")[0] ?? spec;
  return {
    family: familyPart.replace(/\+/g, " ").trim(),
    query: spec.trim(),
  };
}

async function fetchCss(spec: ParsedSpec, signal?: AbortSignal): Promise<string> {
  const url = `https://fonts.googleapis.com/css2?family=${spec.query}&display=swap`;
  const res = await fetch(url, {
    headers: { "User-Agent": LEGACY_UA },
    ...(signal !== undefined ? { signal } : {}),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch font CSS for "${spec.query}" (${res.status}).`);
  }
  return res.text();
}

function fetchBytes(url: string, signal?: AbortSignal): Promise<Uint8Array> {
  let pending = byteCache.get(url);
  if (!pending) {
    pending = (async () => {
      const res = await fetch(url, {
        ...(signal !== undefined ? { signal } : {}),
      });
      if (!res.ok) throw new Error(`Failed to fetch font "${url}" (${res.status}).`);
      return new Uint8Array(await res.arrayBuffer());
    })();
    pending.catch(() => byteCache.delete(url));
    byteCache.set(url, pending);
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

async function resolveSpec(spec: string, signal?: AbortSignal): Promise<ResolvedFont[]> {
  let pending = specCache.get(spec);
  if (!pending) {
    pending = (async () => {
      const parsed = parseSpec(spec);
      const css = await fetchCss(parsed, signal);
      const faces = parseFaces(css, parsed.family);
      return Promise.all(
        faces.map(async (f) => ({
          family: f.family,
          weight: f.weight,
          style: f.style,
          data: await fetchBytes(f.url, signal),
        })),
      );
    })();
    pending.catch(() => specCache.delete(spec));
    specCache.set(spec, pending);
  }
  return pending;
}

export interface FontRegistry {
  /** Resolve Google-Fonts shorthand specs to font buffers (cached). */
  resolve(specs: string[], opts?: { signal?: AbortSignal }): Promise<ResolvedFont[]>;
  /** Pre-seed buffers by source URL (e.g. from R2 / bundled assets in a Worker). */
  seed(entries: { url: string; data: Uint8Array }[]): void;
  /** Drop all caches. */
  clear(): void;
}

export const fonts: FontRegistry = {
  async resolve(specs, opts) {
    const groups = await Promise.all(specs.map((s) => resolveSpec(s, opts?.signal)));
    return groups.flat();
  },
  seed(entries) {
    for (const { url, data } of entries) {
      byteCache.set(url, Promise.resolve(data));
    }
  },
  clear() {
    byteCache.clear();
    specCache.clear();
  },
};

/** Convenience: resolve specs straight to the `Uint8Array[]` resvg wants. */
export async function resolveFontBuffers(
  specs: string[],
  opts?: { signal?: AbortSignal },
): Promise<Uint8Array[]> {
  const resolved = await fonts.resolve(specs, opts);
  return resolved.map((f) => f.data);
}
