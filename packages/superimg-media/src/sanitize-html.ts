//! DOM fragment sanitizer for the render-only composite path.
//!
//! Policy wrapper over **DOMPurify** (baseline). Strips untrusted script surface
//! before morphdom. Raw markup uses DOMPurify or a clone of an exact previously
//! purified fragment. Only the lowerer's internal proof of exact escaped bytes
//! can bypass this path; `needsTemplateSanitization` is advisory, never a gate.
//!
//! Not a multi-tenant HTML sanitizer for CSS `url()` beacons — lightningcss (WASM)
//! is the planned tool for that P2 allowlist work. Residual trust: render-only
//! still uses `allow-same-origin` + morphdom HTML, so styles/backgrounds can
//! trigger network loads; first-party templates are assumed.
//!
//! Native `Sanitizer` / `setHTML` may become a feature-detected fast path later;
//! DOMPurify remains the baseline.
//!
//! Future interactive CTA URL checks (e.g. `data-si-arg` absolute links) must use
//! `new URL(value, base).protocol` — never regex for scheme detection.
//!
//! **Window binding:** DOMPurify needs a standards-compliant browser DOM. We
//! smoke-test the active window before accepting it. Node DOM emulators belong
//! to test setup and never enter the shipped browser graph. The presenter adopts
//! the sanitized fragment into the iframe document for morphdom.

import createDOMPurify, { type DOMPurify, type WindowLike } from "dompurify";

export interface SanitizeStrip {
  kind: "script" | "event-handler" | "base" | "meta-refresh" | "javascript-url" | "other";
  detail: string;
}

export interface SanitizeResult {
  /** Sanitized HTML string (no wrapping #root). */
  html: string;
  stripped: SanitizeStrip[];
}

export interface SanitizeFragmentResult {
  /** Sanitized fragment from DOMPurify (may belong to a different document). */
  fragment: DocumentFragment;
  stripped: SanitizeStrip[];
}

const PURIFY_CONFIG = {
  // Templates have no legitimate <base>/<meta> inside the composite root.
  FORBID_TAGS: ["base", "meta"] as string[],
  // data-si-* CTA attrs: default ALLOW_DATA_ATTR is true.
  // Custom absolute-URL validation for data-si-arg must use new URL(...).protocol.
} as const;

let cachedPurifier: DOMPurify | null = null;
let purifierInit: Promise<DOMPurify> | null = null;

function collectWindowCandidates(): WindowLike[] {
  const candidates: WindowLike[] = [];
  if (typeof globalThis !== "undefined") {
    const g = globalThis as {
      window?: WindowLike;
      document?: { defaultView?: WindowLike | null };
    };
    if (g.window) candidates.push(g.window);
    if (g.document?.defaultView) candidates.push(g.document.defaultView);
  }
  return candidates;
}

function smokeTestPurify(win: WindowLike): boolean {
  try {
    const p = createDOMPurify(win);
    if (!p.isSupported) return false;
    const out = p.sanitize(
      `<div>ok</div><script>alert(1)</script><img src=x onerror=alert(1)>`,
    );
    return (
      typeof out === "string" &&
      out.includes("ok") &&
      !/<script/i.test(out) &&
      !/onerror/i.test(out)
    );
  } catch {
    return false;
  }
}

async function initTrustedPurifier(): Promise<DOMPurify> {
  for (const win of collectWindowCandidates()) {
    if (smokeTestPurify(win)) {
      return createDOMPurify(win);
    }
  }

  throw new Error(
    "DOMPurify requires a standards-compliant browser Window.",
  );
}

/**
 * Resolve a DOMPurify instance. Failed inits clear the cache so a later call
 * can retry after a browser Window becomes available.
 */
export async function getTrustedPurifier(): Promise<DOMPurify> {
  if (cachedPurifier) return cachedPurifier;
  if (!purifierInit) {
    purifierInit = initTrustedPurifier()
      .then((purifier) => {
        cachedPurifier = purifier;
        return purifier;
      })
      .catch((err) => {
        purifierInit = null;
        throw err;
      });
  }
  return purifierInit;
}

/**
 * Resolve a DOMPurify instance bound to a standards-compliant window.
 * Browser hot path only — Node/test callers without a compliant Window must
 * `await getTrustedPurifier()` first.
 */
export function createTrustedPurifier(): DOMPurify {
  if (cachedPurifier) return cachedPurifier;

  for (const win of collectWindowCandidates()) {
    if (smokeTestPurify(win)) {
      cachedPurifier = createDOMPurify(win);
      return cachedPurifier;
    }
  }

  throw new Error(
    "DOMPurify sync init failed — call getTrustedPurifier() first in Node without a compliant Window",
  );
}

/** Test helper: drop cached purifier (e.g. after env change). */
export function resetTrustedPurifierForTests(): void {
  cachedPurifier = null;
  purifierInit = null;
}

/** Test-only seam: provide a standards-compliant DOM without shipping an emulator. */
export function primeTrustedPurifierForTests(win: WindowLike): void {
  if (!smokeTestPurify(win)) {
    throw new Error("The supplied sanitizer test Window failed the DOMPurify smoke test.");
  }
  cachedPurifier = createDOMPurify(win);
  purifierInit = Promise.resolve(cachedPurifier);
}

function mapRemoved(purifier: DOMPurify): SanitizeStrip[] {
  const stripped: SanitizeStrip[] = [];
  for (const entry of purifier.removed) {
    if ("element" in entry && entry.element) {
      const el = entry.element as Element;
      const tag = (el.nodeName || "").toLowerCase();
      if (tag === "script") {
        stripped.push({
          kind: "script",
          detail: el.getAttribute?.("src") || el.textContent?.slice(0, 40) || "<script>",
        });
      } else if (tag === "base") {
        stripped.push({
          kind: "base",
          detail: (el as Element).outerHTML?.slice(0, 80) || "<base>",
        });
      } else if (tag === "meta") {
        stripped.push({
          kind: "meta-refresh",
          detail: (el as Element).outerHTML?.slice(0, 80) || "<meta>",
        });
      } else if (tag && tag !== "#text" && tag !== "body" && tag !== "html" && tag !== "head") {
        stripped.push({ kind: "other", detail: tag });
      }
    } else if ("attribute" in entry && entry.attribute) {
      const attr = entry.attribute as Attr;
      const name = (attr.name || "").toLowerCase();
      const value = attr.value ?? "";
      const from = "from" in entry ? (entry.from as Element | undefined) : undefined;
      const host = from?.tagName?.toLowerCase?.() ?? "el";
      if (name.startsWith("on")) {
        stripped.push({ kind: "event-handler", detail: `${host}[${name}]` });
      } else if (isJavascriptOrDataUrl(value)) {
        stripped.push({ kind: "javascript-url", detail: `${host}[${name}]` });
      } else {
        stripped.push({ kind: "other", detail: `${host}[${name}]` });
      }
    }
  }
  return stripped;
}

function isJavascriptOrDataUrl(value: string): boolean {
  return (
    /^\s*javascript:/i.test(value) ||
    /java[\s\u0000-\u001f]*script\s*:/i.test(value) ||
    /^\s*data\s*:/i.test(value)
  );
}

/**
 * Cheap advisory prefilter — true means “looks executable.”
 * **Not a security gate:** raw markup with `stripHtml` must use DOMPurify or an
 * exact cached purified fragment. This prefilter cannot authorize a bypass.
 * False positives are fine; false negatives must not skip sanitization.
 */
export function needsTemplateSanitization(html: string): boolean {
  const lower = html.toLowerCase();
  if (lower.includes("<script")) return true;
  if (lower.includes("javascript:")) return true;
  if (lower.includes("<base")) return true;
  if (lower.includes("http-equiv")) return true;
  if (lower.includes("formaction")) return true;
  if (lower.includes("<iframe")) return true;
  if (lower.includes("<object")) return true;
  if (lower.includes("<embed")) return true;
  if (lower.includes("srcdoc")) return true;
  // Match on* after `<`, `/`, or whitespace (covers `<svg/onload=…>`)
  if (/[<\s/]on[a-z]+\s*=/i.test(html)) return true;
  return false;
}

/**
 * Sanitize template HTML via DOMPurify and return a DOM fragment + strip log.
 *
 * - FORBID_TAGS: `base`, `meta`
 * - `data-si-*` preserved via DOMPurify default `ALLOW_DATA_ATTR: true`
 * - Scripts, on*, javascript: URLs (including tab/mXSS encodings) handled by core
 */
export function sanitizeTemplateFragmentNode(html: string, _doc: Document): SanitizeFragmentResult {
  const purify = createTrustedPurifier();
  purify.removed.length = 0;

  const fragment = purify.sanitize(html, {
    ...PURIFY_CONFIG,
    RETURN_DOM_FRAGMENT: true,
  }) as DocumentFragment;

  const stripped = mapRemoved(purify);
  return { fragment, stripped };
}

/** Numeric observations only; source markup and removed attribute values stay private. */
export interface SanitizedFragmentCacheStats {
  hits: number;
  misses: number;
  entries: number;
  recentSources: number;
  retainedSourceBytes: number;
  retainedNodes: number;
}

interface CachedSanitizedFragment {
  fragment: DocumentFragment;
  stripped: SanitizeStrip[];
  nodes: number;
}

/**
 * Presenter-owned exact-byte cache. Every admitted value has already passed the
 * same DOMPurify policy; returned clones cannot mutate its private fragments.
 * Admission requires a repeated source so continuously changing animation does
 * not pay for a sanitized DOM clone on every miss. Source bytes, entry count and
 * retained DOM nodes each have an independent hard bound.
 *
 * This caches complete, independently purified fragments, never a substring or
 * a caller-provided "trusted" island. It cannot speed up unique monolithic SVG.
 */
export class SanitizedFragmentCache {
  private readonly entries = new Map<string, CachedSanitizedFragment>();
  private readonly recent = new Map<string, true>();
  private sourceBytes = 0;
  private nodes = 0;
  private hits = 0;
  private misses = 0;
  private purifier: DOMPurify | null = null;

  constructor(
    private readonly doc: Document,
    private readonly maxEntries = 8,
    private readonly maxSourceBytes = 512 * 1024,
    private readonly maxNodes = 8192,
  ) {}

  sanitize(html: string): SanitizeFragmentResult {
    const purifier = createTrustedPurifier();
    // A test/runtime Window replacement also changes the active policy owner.
    if (this.purifier !== purifier) {
      this.clear();
      this.purifier = purifier;
    }
    const cached = this.entries.get(html);
    if (cached) {
      this.hits += 1;
      this.entries.delete(html);
      this.entries.set(html, cached);
      return {
        fragment: cached.fragment.cloneNode(true) as DocumentFragment,
        stripped: cached.stripped.map((strip) => ({ ...strip })),
      };
    }
    this.misses += 1;
    const result = sanitizeTemplateFragmentNode(html, this.doc);
    const bytes = html.length * 2;
    if (bytes > this.maxSourceBytes || this.maxEntries <= 0 || this.maxNodes <= 0) return result;

    if (this.recent.has(html)) {
      this.recent.delete(html);
      this.sourceBytes -= bytes;
      const walker = result.fragment.ownerDocument.createTreeWalker(result.fragment);
      let count = 0;
      // Stop counting oversized fragments as soon as they cannot be admitted.
      while (walker.nextNode() && count <= this.maxNodes) count += 1;
      if (count <= this.maxNodes) {
        this.entries.set(html, {
          fragment: result.fragment.cloneNode(true) as DocumentFragment,
          stripped: result.stripped.map((strip) => ({ ...strip })),
          nodes: count,
        });
        this.sourceBytes += bytes;
        this.nodes += count;
      }
    } else {
      this.recent.set(html, true);
      this.sourceBytes += bytes;
    }
    this.enforceBounds();
    return result;
  }

  private enforceBounds(): void {
    while (this.recent.size > this.maxEntries || this.sourceBytes > this.maxSourceBytes) {
      const oldest = this.recent.keys().next().value;
      if (oldest === undefined) break;
      this.recent.delete(oldest);
      this.sourceBytes -= oldest.length * 2;
    }
    while (this.entries.size > this.maxEntries || this.sourceBytes > this.maxSourceBytes || this.nodes > this.maxNodes) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      const entry = this.entries.get(oldest)!;
      this.entries.delete(oldest);
      this.sourceBytes -= oldest.length * 2;
      this.nodes -= entry.nodes;
    }
  }

  getStats(): Readonly<SanitizedFragmentCacheStats> {
    return Object.freeze({
      hits: this.hits,
      misses: this.misses,
      entries: this.entries.size,
      recentSources: this.recent.size,
      retainedSourceBytes: this.sourceBytes,
      retainedNodes: this.nodes,
    });
  }

  clear(): void {
    this.entries.clear();
    this.recent.clear();
    this.sourceBytes = 0;
    this.nodes = 0;
  }
}

/**
 * Sanitize template HTML via DOMPurify and return a string + strip log.
 * String path for tests and external callers — hot present() uses
 * {@link sanitizeTemplateFragmentNode} to avoid a second parse.
 */
export function sanitizeTemplateHtml(html: string, _doc: Document): SanitizeResult {
  const purify = createTrustedPurifier();
  purify.removed.length = 0;

  const clean = purify.sanitize(html, {
    ...PURIFY_CONFIG,
  }) as string;

  const stripped = mapRemoved(purify);
  return { html: clean, stripped };
}

/** Design-doc name for {@link sanitizeTemplateFragmentNode}. */
export const sanitizeTemplateFragment = sanitizeTemplateFragmentNode;

/** Detect wall-clock CSS animation hooks that won't scrub with parent media time. */
export function detectWallClockCssHints(html: string): string[] {
  const hints: string[] = [];
  if (/animation-name\s*:/i.test(html) || /@keyframes\b/i.test(html)) {
    hints.push("css-animation");
  }
  if (/animation-timeline\s*:\s*(scroll|view)\s*\(/i.test(html)) {
    hints.push("scroll-driven-animation");
  }
  if (/@starting-style\b/i.test(html)) {
    hints.push("starting-style");
  }
  return hints;
}

export function logSanitizeWarnings(
  stripped: SanitizeStrip[],
  opts?: { sourceId?: string },
): void {
  if (stripped.length === 0 || typeof console === "undefined") return;
  const id = opts?.sourceId ? ` media "${opts.sourceId}"` : "";
  const sample = stripped
    .slice(0, 3)
    .map((s) => `${s.kind}:${s.detail}`)
    .join("; ");
  console.warn(
    `[SuperImg] Stripped ${stripped.length} unsafe construct(s)${id} — scripts/handlers require the dev player (trusted scripts). ${sample}` +
      (stripped.length > 3 ? "…" : "") +
      " Prefer std.css()/inlineCss for production embeds, or use the dev player for first-party canvas/Tailwind islands.",
  );
}

export function logWallClockCssWarnings(hints: string[]): void {
  if (hints.length === 0 || typeof console === "undefined") return;
  console.warn(
    `[SuperImg] Template HTML uses wall-clock CSS (${hints.join(", ")}). Scrub/export may diverge until parent-driven CSS seek (WAAPI) is applied. Prefer timeline-driven styles or @keyframes intended for seek binding.`,
  );
}
