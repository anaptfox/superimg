/**
 * Background utilities for SuperImg templates
 *
 * High-level helpers for common background patterns like Ken Burns effect.
 *
 * @example
 * ```ts
 * // Before (~25 lines):
 * const zoom = std.tween(1.0, 1.1, std.math.clamp(time / duration, 0, 1), "linear");
 * // + background div + overlay div HTML
 *
 * // After (3 lines):
 * const bg = std.backgrounds.kenBurns({ src: imageUrl, progress });
 * return `<div style="...">${bg.html}${content}</div>`;
 * ```
 */

import { tween } from "./tween";
import { css } from "./css";
import { clamp01 } from "./easing";

/** Options for Ken Burns background effect */
export interface KenBurnsOptions {
  /** Image source URL */
  src: string;
  /** Animation progress (0-1) for zoom */
  progress: number;
  /** Starting zoom level (default: 1.0) */
  zoomFrom?: number;
  /** Ending zoom level (default: 1.1) */
  zoomTo?: number;
  /** Overlay color (default: "rgba(0,0,0,0.5)") */
  overlay?: string;
  /** Background position (default: "center") */
  position?: string;
  /** Overflow buffer in pixels for zoom (default: 50) */
  overflow?: number;
}

/** Result of Ken Burns calculation */
export interface KenBurnsResult {
  /** Current zoom value */
  zoom: number;
  /** Inline style for the background image div */
  backgroundStyle: string;
  /** Inline style for the overlay div */
  overlayStyle: string;
  /** Complete HTML for background + overlay (without wrapper) */
  html: string;
}

/**
 * Generate Ken Burns background effect (zoom + overlay).
 *
 * Creates the CSS and HTML for a slowly-zooming background image with
 * a semi-transparent overlay. The zoom animates from zoomFrom to zoomTo
 * over the progress range.
 *
 * @param options - Ken Burns options
 * @returns KenBurnsResult with zoom value, styles, and pre-built HTML
 *
 * @example
 * ```ts
 * const bg = std.backgrounds.kenBurns({
 *   src: backgroundImage,
 *   progress: time / duration,
 *   overlay: "rgba(0, 0, 0, 0.6)"
 * });
 *
 * return `
 *   <div style="${std.css({ width, height, position: 'relative', overflow: 'hidden' })}">
 *     ${bg.html}
 *     <div style="position: relative; z-index: 1;">
 *       <!-- Content here -->
 *     </div>
 *   </div>
 * `;
 * ```
 */
export function kenBurns(options: KenBurnsOptions): KenBurnsResult {
  const {
    src,
    progress,
    zoomFrom = 1.0,
    zoomTo = 1.1,
    overlay = "rgba(0,0,0,0.5)",
    position = "center",
    overflow = 50,
  } = options;

  const t = clamp01(progress);
  const zoom = tween(zoomFrom, zoomTo, t, "linear");

  const backgroundStyle = css({
    position: "absolute",
    inset: -overflow,
    backgroundImage: `url(${src})`,
    backgroundSize: "cover",
    backgroundPosition: position,
    transform: `scale(${zoom})`,
    transformOrigin: "center center",
  });

  const overlayStyle = css({
    position: "absolute",
    inset: 0,
    background: overlay,
  });

  const html = `<div style="${backgroundStyle}"></div><div style="${overlayStyle}"></div>`;

  return { zoom, backgroundStyle, overlayStyle, html };
}
