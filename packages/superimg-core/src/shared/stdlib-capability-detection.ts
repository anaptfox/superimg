import type { MediaCapabilities, MediaCapabilityName } from "@superimg/types";
import type { RuntimeTemplate } from "../rendering/runtime-info.js";
import {
  STDLIB_CAPABILITIES,
  type StdlibCapability,
} from "./stdlib-capability-types.js";

/**
 * Compiler/fallback-only capability discovery. Shipped stamped programs do not
 * pull these source-analysis heuristics into the common Player graph.
 */
const CAPABILITY_PATTERNS: ReadonlyArray<readonly [StdlibCapability, RegExp]> = [
  ["math", /\bstd\.math\b/],
  ["color", /\bstd\.color\b|\bstd\.interpolateColor\b/],
  ["date", /\bstd\.date\b/],
  ["text", /\bstd\.text\b/],
  ["layout", /\bstd\.layout\b/],
  ["svg", /\bstd\.svg\.(?!rough\b)/],
  [
    "viz",
    /\bstd\.viz\.(?!(?:katex|equation|equationSteps|equationMatch|katexCss|lottie|mermaid|three)\b)/,
  ],
  ["subtitle", /\bstd\.subtitle\b/],
  ["backgrounds", /\bstd\.backgrounds\b/],
  ["montage", /\bstd\.montage\b/],
  ["path", /\bstd\.path\b/],
  ["reveal", /\bstd\.reveal\b/],
  ["responsive", /\bstd\.(?:responsive|createResponsive)\b/],
  ["carousel", /\bstd\.carousel\b/],
  ["stack", /\bstd\.stack\b/],
  ["spring", /\bstd\.spring\b/],
  ["stagger", /\bstd\.stagger\b/],
  ["timing", /\bstd\.timing\b/],
  ["phases", /\bstd\.phases\b/],
  ["motion", /\bstd\.motion\b/],
  ["safe-area", /\bstd\.(?:safeArea|safeBox)\b/],
  ["oscillate", /\bstd\.(?:oscillate|loop|pingpong|wiggle)\b/],
  ["ready", /\bstd\.ready\b/],
  ["layout-timeline", /\bstd\.layoutTimeline\b/],
  ["interpolate", /\bstd\.interpolate\b/],
  ["code", /\bstd\.code\b/],
  ["rough", /\bstd\.svg\.rough\b/],
  [
    "katex",
    /\bstd\.viz\.katex\b|\bstd\.viz\.(?:equation|equationSteps|equationMatch|katexCss)\b/,
  ],
  ["lottie", /\bstd\.viz\.lottie\b/],
  ["mermaid", /\bstd\.viz\.mermaid\b/],
  ["three", /\bstd\.viz\.three\b/],
];

function expandStdlibNamespaceAliases(source: string): string {
  type Namespace =
    | "math"
    | "color"
    | "date"
    | "text"
    | "layout"
    | "viz"
    | "svg"
    | "subtitle"
    | "backgrounds"
    | "path"
    | "responsive"
    | "timing"
    | "phases"
    | "motion"
    | "code";
  const rootAliases = new Set<string>();
  const rootDeclaration =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:[A-Za-z_$][\w$]*\.)?std\b(?!\.)/g;
  for (const match of source.matchAll(rootDeclaration)) rootAliases.add(match[1]!);
  // Bundlers commonly lower `const { std } = ctx` to `let { std: n } = e`.
  const rootDestructuring = /\b(?:const|let|var)\s*\{([^{}]*)\}\s*=/g;
  for (const declaration of source.matchAll(rootDestructuring)) {
    for (const binding of declaration[1]!.matchAll(
      /(?:^|,)\s*std\s*:\s*([A-Za-z_$][\w$]*)\s*(?=,|$)/g,
    )) {
      rootAliases.add(binding[1]!);
    }
  }

  let normalized = source;
  for (const alias of rootAliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalized = normalized
      .replace(new RegExp(`\\b${escaped}\\.`, "g"), "std.")
      .replace(new RegExp(`\\b${escaped}\\s*\\[`, "g"), "std[");
  }

  const aliases = new Map<string, Namespace>();
  const declaration =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:[A-Za-z_$][\w$]*\.)?std\.(math|color|date|text|layout|viz|svg|subtitle|backgrounds|path|responsive|timing|phases|motion|code)\b/g;

  for (const match of normalized.matchAll(declaration)) {
    aliases.set(match[1]!, match[2]! as Namespace);
  }
  if (aliases.size === 0) return normalized;

  const expanded = [normalized];
  for (const [alias, namespace] of aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expanded.push(normalized.replace(new RegExp(`\\b${escaped}\\.`, "g"), `std.${namespace}.`));
  }
  return expanded.join("\n");
}

function stampKeys(template: object): object[] {
  const keys: object[] = [template];
  const render = (template as { render?: unknown }).render;
  if (typeof render === "function") keys.push(render);
  return keys;
}

const stampedCapabilities = new WeakMap<object, readonly StdlibCapability[]>();
const stampedMediaCapabilities = new WeakMap<object, MediaCapabilities>();

function readStamped(template: object): readonly StdlibCapability[] | undefined {
  for (const key of stampKeys(template)) {
    const capabilities = stampedCapabilities.get(key);
    if (capabilities) return capabilities;
  }
  return undefined;
}

export function detectStdlibCapabilitiesFromSource(source: string): StdlibCapability[] {
  const expandedSource = expandStdlibNamespaceAliases(source);
  if (/\b(?:ctx\.)?std(?:\.[A-Za-z_$][\w$]*)*\s*\[/.test(expandedSource)) {
    return [...STDLIB_CAPABILITIES];
  }
  return CAPABILITY_PATTERNS.flatMap(([name, pattern]) =>
    pattern.test(expandedSource) ? [name] : [],
  );
}

export function detectMediaCapabilitiesFromSource(source: string): MediaCapabilities {
  const names = new Set<MediaCapabilityName>(detectStdlibCapabilitiesFromSource(source));
  if (/\bstd\.viz\.canvas\b|\b<canvas\b/i.test(source)) names.add("canvas");
  if (/\bstd\.viz\.three\b|WebGLRenderer|webgl/i.test(source)) names.add("webgl");
  if (/\bstd\.viz\.lottie\b/.test(source)) names.add("lottie");
  if (/<script\b/i.test(source) || /\bstd\.viz\.(?:canvas|three|lottie)\b/.test(source)) {
    names.add("scripts");
  }
  if (/\btailwind\s*:/.test(source) || /\bconfig\.tailwind\b/.test(source)) {
    names.add("tailwind");
  }
  if (/\bactions\s*:\s*\[/.test(source) && /data-si-actions|actions:\s*\[/.test(source)) {
    names.add("interactive");
  }
  if (/@keyframes\b|animation-name\s*:/i.test(source)) names.add("css-animation");
  if (/\bfonts\s*:/.test(source)) names.add("fonts");
  return { version: 0, names: [...names] };
}

export function stampStdlibCapabilitiesFromSource(
  template: object,
  bundledSource: string,
): void {
  const capabilities = detectStdlibCapabilitiesFromSource(bundledSource);
  const mediaCapabilities = detectMediaCapabilitiesFromSource(bundledSource);
  for (const key of stampKeys(template)) {
    stampedCapabilities.set(key, capabilities);
    stampedMediaCapabilities.set(key, mediaCapabilities);
  }
  Object.defineProperty(template, "mediaCapabilities", {
    value: mediaCapabilities,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

export function getStampedMediaCapabilities(template: object): MediaCapabilities | undefined {
  for (const key of stampKeys(template)) {
    const capabilities = stampedMediaCapabilities.get(key);
    if (capabilities) return capabilities;
  }
  const direct = (template as { mediaCapabilities?: MediaCapabilities }).mediaCapabilities;
  return direct?.version === 0 ? direct : undefined;
}

export function copyStdlibCapabilityStamp(from: object, to: object): void {
  const capabilities = readStamped(from);
  if (capabilities) {
    for (const key of stampKeys(to)) stampedCapabilities.set(key, capabilities);
  }
  const mediaCapabilities = getStampedMediaCapabilities(from);
  if (!mediaCapabilities) return;
  for (const key of stampKeys(to)) {
    stampedMediaCapabilities.set(key, mediaCapabilities);
  }
  Object.defineProperty(to, "mediaCapabilities", {
    value: mediaCapabilities,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

export interface StdlibCapabilitySource {
  readonly render: Function;
  readonly mediaCapabilities?: NonNullable<RuntimeTemplate["mediaCapabilities"]>;
}

export function detectStdlibCapabilities(template: StdlibCapabilitySource): StdlibCapability[] {
  const seen = new Set<StdlibCapability>();
  const visited = new Set<object>();
  let source: object | undefined = template;
  // Lowered interactive media wraps the authored callback, and the controller
  // wraps it again. Follow retained authorship only in this fallback path;
  // declared manifests remain authoritative in capabilitiesForTemplate.
  while (source !== undefined && !visited.has(source)) {
    visited.add(source);
    const render = (source as { render?: unknown }).render;
    if (typeof render === "function") {
      for (const capability of detectStdlibCapabilitiesFromSource(render.toString())) seen.add(capability);
    }
    for (const capability of readStamped(source) ?? []) seen.add(capability);
    const original: unknown = Reflect.get(source, Symbol.for("superimg.stdlib-capability-source"));
    source = typeof original === "object" && original !== null ? original : undefined;
  }
  return STDLIB_CAPABILITIES.filter((name) => seen.has(name));
}
