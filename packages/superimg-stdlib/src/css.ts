/**
 * CSS style utilities for SuperImg templates
 *
 * Converts style objects to inline style strings with auto-px for numeric values.
 * Use for dynamic per-frame styles; pair with config.inlineCss/config.stylesheets for static utility classes.
 *
 * @example
 * ```ts
 * std.css({ width: 1920, height: 1080, opacity: 0.8 })
 * // "width:1920px;height:1080px;opacity:0.8"
 *
 * std.css.fill()
 * // "position:absolute;top:0;left:0;width:100%;height:100%"
 * ```
 */

import unitless from "@emotion/unitless";

/** Canonical unitless properties (camelCase) from @emotion/unitless */
const UNITLESS_KEYS = new Set(Object.keys(unitless));

function camelToKebab(str: string): string {
  // Handle vendor prefixes: WebkitX → -webkit-x, MozX → -moz-x, msX → -ms-x
  const kebab = str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  if (/^(webkit|moz|ms|o)-/.test(kebab)) return `-${kebab}`;
  return kebab;
}

function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function isUnitlessProperty(key: string): boolean {
  if (key.startsWith("--")) return true;
  const camel = key.includes("-") ? kebabToCamel(key) : key;
  if (UNITLESS_KEYS.has(camel)) return true;
  const unprefixed = camel.replace(/^(Webkit|Moz|ms|O)/, "");
  const normalized = unprefixed
    ? unprefixed.charAt(0).toLowerCase() + unprefixed.slice(1)
    : "";
  return normalized ? UNITLESS_KEYS.has(normalized) : false;
}

type Property = { name: string; unitless: boolean };
// Cache property metadata, never style objects or values. Bound dynamic keys so
// long-lived players cannot retain an unbounded author-controlled vocabulary.
const properties = new Map<string, Property>();
function property(key: string): Property {
  const cached = properties.get(key);
  if (cached) return cached;
  const result = { name: camelToKebab(key), unitless: isUnitlessProperty(key) };
  if (key.length <= 64 && !key.startsWith("--")) {
    if (properties.size >= 256) properties.delete(properties.keys().next().value!);
    properties.set(key, result);
  }
  return result;
}

function serializeValue(unitless: boolean, value: unknown): string {
  if (typeof value === "number") {
    if (unitless) return String(value);
    return `${value}px`;
  }
  return String(value);
}

/**
 * Convert style objects and preset strings to an inline style string.
 * Accepts any mix of style objects and preset strings (from css.fill(), css.center(), etc.).
 * Numeric values get 'px' appended except for unitless properties (opacity, zIndex, etc.).
 * null/undefined values are omitted. Empty strings are ignored.
 *
 * @param args - Style objects and/or preset strings to combine
 * @returns Semicolon-separated inline style string
 *
 * @example
 * ```ts
 * std.css({ width: 1920, height: 1080 }, std.css.center())
 * // "width:1920px;height:1080px;display:flex;align-items:center;justify-content:center"
 * ```
 */
export function css(...args: (Record<string, unknown> | string)[]): string {
  const parts: string[] = [];
  for (const arg of args) {
    if (typeof arg === "string") {
      if (arg) parts.push(arg);
    } else {
      for (const [key, value] of Object.entries(arg)) {
        if (value === null || value === undefined) continue;
        const metadata = property(key);
        parts.push(`${metadata.name}:${serializeValue(metadata.unitless, value)}`);
      }
    }
  }
  return parts.join(";");
}

/**
 * Preset: fill container (position absolute, full width/height).
 * Use for root/wrapper divs that should cover the canvas.
 */
export function fill(): string {
  return "position:absolute;top:0;left:0;width:100%;height:100%";
}

/**
 * Preset: flexbox center (horizontal and vertical).
 * Use for centering content.
 */
export function center(): string {
  return "display:flex;align-items:center;justify-content:center";
}

/**
 * Preset: flexbox column layout.
 * Use for vertical layouts.
 */
export function column(): string {
  return "display:flex;flex-direction:column";
}

/**
 * Preset: flexbox row layout.
 * Use for horizontal layouts (opposite of stack).
 */
export function row(): string {
  return "display:flex;flex-direction:row";
}

export interface DitherNoiseOptions {
  /** Noise opacity 0–1 (default 0.04). */
  opacity?: number;
  /** Blend mode (default "overlay"). */
  blendMode?: string;
  /** Base frequency for SVG turbulence (default 0.65). */
  frequency?: number;
  /** Seed for feTurbulence (default 1). */
  seed?: number;
}

/**
 * Fine grain / dither style fragment for banding reduction on gradients.
 * Returns only CSS (background SVG data-URI + blend). Mount as a full-bleed
 * layer or combine with `std.css.fill()`.
 */
export function ditherNoise(opts: DitherNoiseOptions = {}): string {
  const opacity = opts.opacity ?? 0.04;
  const blend = opts.blendMode ?? "overlay";
  const freq = opts.frequency ?? 0.65;
  const seed = opts.seed ?? 1;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='3' seed='${seed}' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='1'/></svg>`;
  const uri = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  return [
    `background-image:${uri}`,
    "background-repeat:repeat",
    "background-size:128px 128px",
    `opacity:${opacity}`,
    `mix-blend-mode:${blend}`,
    "pointer-events:none",
  ].join(";");
}

export interface AppleGlassOptions {
  /** Frost blur radius in px (default 20). */
  blur?: number;
  /** Fill color (default translucent white). */
  fill?: string;
  /** Border color (default subtle white). */
  border?: string;
  /** Border radius (default 16). */
  radius?: number | string;
  /** Box shadow (default soft). */
  shadow?: string;
}

/**
 * Translucent glass material style recipe (backdrop-filter + fill + border).
 * Pair with a positioned container; does not emit HTML structure.
 */
export function appleGlass(opts: AppleGlassOptions = {}): string {
  const blur = opts.blur ?? 20;
  const fill = opts.fill ?? "rgba(255,255,255,0.12)";
  const border = opts.border ?? "1px solid rgba(255,255,255,0.22)";
  const radius =
    typeof opts.radius === "number"
      ? `${opts.radius}px`
      : (opts.radius ?? "16px");
  const shadow =
    opts.shadow ?? "0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.25)";
  return [
    `background:${fill}`,
    `-webkit-backdrop-filter:saturate(180%) blur(${blur}px)`,
    `backdrop-filter:saturate(180%) blur(${blur}px)`,
    `border:${border}`,
    `border-radius:${radius}`,
    `box-shadow:${shadow}`,
  ].join(";");
}
