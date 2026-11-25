//! Scrape inspect-friendly semantics from rendered frame HTML (no DOM).

export interface HtmlSemantics {
  text: string[];
  colors: string[];
  eqKeys: string[];
  waitLabels: string[];
  cameraScale: number | null;
}

const MAX_TEXT_TOKENS = 50;

/** Strip tags, collapse whitespace, unique non-empty tokens (capped). */
function extractText(html: string): string[] {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  if (!stripped) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of stripped.split(" ")) {
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= MAX_TEXT_TOKENS) break;
  }
  return out;
}

function extractColors(html: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string) => {
    const c = raw.toLowerCase();
    if (seen.has(c)) return;
    seen.add(c);
    out.push(c);
  };

  // #rgb / #rrggbb / #rrggbbaa
  for (const m of html.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
    push(`#${m[1]!}`);
  }
  // stroke="..." fill="..." color:...
  for (const m of html.matchAll(/(?:stroke|fill)\s*=\s*["']([^"']+)["']/gi)) {
    const v = m[1]!.trim();
    if (v.startsWith("#") || v.startsWith("rgb") || v.startsWith("hsl")) push(v.toLowerCase());
  }
  for (const m of html.matchAll(/(?:^|[;\s])color\s*:\s*([^;}"']+)/gi)) {
    const v = m[1]!.trim().toLowerCase();
    if (v.startsWith("#") || v.startsWith("rgb") || v.startsWith("hsl")) push(v);
  }

  return out;
}

function extractAttrValues(html: string, attr: string): string[] {
  const re = new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, "gi");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of html.matchAll(re)) {
    const v = m[1]!.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function extractCameraScale(html: string): number | null {
  const m = html.match(/scale\(\s*([0-9.]+)\s*\)/i);
  if (!m) return null;
  const n = parseFloat(m[1]!);
  return Number.isFinite(n) ? n : null;
}

export function scrapeHtmlSemantics(html: string): HtmlSemantics {
  return {
    text: extractText(html),
    colors: extractColors(html),
    eqKeys: extractAttrValues(html, "data-eq-key"),
    waitLabels: extractAttrValues(html, "data-superimg-wait"),
    cameraScale: extractCameraScale(html),
  };
}
