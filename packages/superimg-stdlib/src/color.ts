/**
 * Color manipulation utilities for SuperImg templates
 *
 * Provides functions for color conversion, manipulation, and formatting.
 * Uses colord library for robust color operations.
 */

import { colord, extend } from 'colord';
import mixPlugin from 'colord/plugins/mix';

extend([mixPlugin]);

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

/**
 * Convert hex color to RGB.
 * @ai-hint Accepts both "#FF0000" and "FF0000" (with or without `#`). Throws on invalid input.
 * @param hex - Hex color string (e.g., "#FF0000" or "FF0000")
 * @returns RGB object `{ r: number, g: number, b: number }` with values in [0, 255]
 */
export function hexToRgb(hex: string): RGB {
  // Ensure hex has # prefix for colord
  const normalizedHex = hex.startsWith('#') ? hex : `#${hex}`;
  const c = colord(normalizedHex);
  if (!c.isValid()) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const { r, g, b } = c.toRgb();
  return { r, g, b };
}

/**
 * Convert RGB to hex color
 * @param r - Red (0-255)
 * @param g - Green (0-255)
 * @param b - Blue (0-255)
 * @returns Hex color string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return colord({ r, g, b }).toHex();
}

/**
 * Convert HSL to RGB
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param l - Lightness (0-100)
 * @returns RGB object
 */
export function hslToRgb(h: number, s: number, l: number): RGB {
  const c = colord({ h, s, l });
  const { r, g, b } = c.toRgb();
  return { r, g, b };
}

/**
 * Convert RGB to HSL
 * @param r - Red (0-255)
 * @param g - Green (0-255)
 * @param b - Blue (0-255)
 * @returns HSL object
 */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  const c = colord({ r, g, b });
  const { h, s, l } = c.toHsl();
  return {
    h: Math.round(h),
    s: Math.round(s),
    l: Math.round(l),
  };
}

/**
 * Create an HSL color string from hue, saturation, and lightness values.
 * @ai-hint Returns a CSS `hsl()` string, safe to use directly in style attributes.
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param l - Lightness (0-100)
 * @returns CSS HSL color string, e.g. `"hsl(180, 50%, 50%)"`
 */
export function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

/**
 * Parse a color string to RGB
 * Supports hex (#FF0000), rgb(r,g,b), hsl(h,s%,l%), and named colors
 * @param str - Color string
 * @returns RGB object
 */
export function parseColor(str: string): RGB {
  const c = colord(str);
  if (!c.isValid()) {
    throw new Error(`Invalid color format: ${str}`);
  }
  const { r, g, b } = c.toRgb();
  return { r, g, b };
}

/**
 * Darken a color by a percentage.
 * @ai-hint amount is 0-100 (percentage), not 0-1. `darken('#fff', 50)` → mid-gray.
 * @param color - Color string (hex, rgb, hsl, named)
 * @param amount - Amount to darken (0-100), where 100 = black
 * @returns Darkened color as hex string
 */
export function darken(color: string, amount: number): string {
  return colord(color).darken(amount / 100).toHex();
}

/**
 * Lighten a color by a percentage.
 * @ai-hint amount is 0-100 (percentage), not 0-1. `lighten('#000', 50)` → mid-gray.
 * @param color - Color string (hex, rgb, hsl, named)
 * @param amount - Amount to lighten (0-100), where 100 = white
 * @returns Lightened color as hex string
 */
export function lighten(color: string, amount: number): string {
  return colord(color).lighten(amount / 100).toHex();
}

/**
 * Add alpha channel to a color.
 * @ai-hint Returns `rgba(...)` string, safe to use directly in CSS/HTML style attributes.
 * @param color - Color string (hex, rgb, hsl, named)
 * @param opacity - Opacity value in [0, 1] where 0 = transparent, 1 = opaque
 * @returns RGBA color string, e.g. `"rgba(255, 0, 0, 0.5)"`
 */
export function alpha(color: string, opacity: number): string {
  const c = colord(color).alpha(opacity);
  // Always return rgba format, even if opacity is 1
  const { r, g, b, a } = c.toRgb();
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Mix two colors.
 * @ai-hint weight=1 returns c1, weight=0 returns c2 — opposite of CSS `color-mix()`.
 * @param c1 - First color
 * @param c2 - Second color
 * @param weight - Weight of first color in [0, 1]. 1 = all c1, 0 = all c2.
 * @returns Mixed color as hex string
 */
export function mix(c1: string, c2: string, weight: number): string {
  return colord(c1).mix(c2, 1 - weight).toHex();
}

/**
 * Saturate a color by a percentage
 * @param color - Color string
 * @param amount - Amount to saturate (0-100)
 * @returns Saturated color as hex
 */
export function saturate(color: string, amount: number): string {
  return colord(color).saturate(amount / 100).toHex();
}

/**
 * Desaturate a color by a percentage
 * @param color - Color string
 * @param amount - Amount to desaturate (0-100)
 * @returns Desaturated color as hex
 */
export function desaturate(color: string, amount: number): string {
  return colord(color).desaturate(amount / 100).toHex();
}

/**
 * Check if a color is light (useful for text color decisions)
 * @param color - Color string
 * @returns True if color is light
 */
export function isLight(color: string): boolean {
  return colord(color).isLight();
}
