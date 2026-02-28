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
  const normalized = unprefixed ? unprefixed[0].toLowerCase() + unprefixed.slice(1) : "";
  return normalized ? UNITLESS_KEYS.has(normalized) : false;
}

function serializeValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (isUnitlessProperty(key)) return String(value);
    return `${value}px`;
  }
  return String(value);
}

/**
 * Convert a style object to an inline style string.
 * Numeric values get 'px' appended except for unitless properties (opacity, zIndex, etc.).
 * null/undefined values are omitted.
 *
 * @param styles - Object with camelCase CSS property names
 * @returns Semicolon-separated inline style string
 */
export function css(styles: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(styles)) {
    const serialized = serializeValue(key, value);
    if (serialized !== null) {
      parts.push(`${camelToKebab(key)}:${serialized}`);
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
 * Preset: flexbox column stack.
 * Use for vertical layouts.
 */
export function stack(): string {
  return "display:flex;flex-direction:column";
}
