/**
 * SVG text on a curved path.
 *
 * Returns an SVG snippet with <defs>, <path>, <text>, and <textPath> elements.
 * Animate the offset option to scroll text along the path.
 *
 * @example
 * ```ts
 * const wave = std.svg.shape.wave(1920, 300, 80, 2);
 * const offset = std.tween(0, 100, sceneProgress, "easeInOutSine");
 * const svg = std.svg.textPath("SUPERIMG", wave, { offset, fontSize: 72 });
 * return `<svg width="1920" height="400" viewBox="0 0 1920 400">${svg}</svg>`;
 * ```
 */

export interface TextPathOptions {
  /** Offset along path (0-100%). Default: 0 */
  offset?: number;
  /** Font size in pixels. Default: 48 */
  fontSize?: number;
  /** Fill color. Default: "white" */
  fill?: string;
  /** Font family. Default: "inherit" */
  fontFamily?: string;
  /** Font weight. Default: "normal" */
  fontWeight?: string;
  /** Letter spacing. Default: "normal" */
  letterSpacing?: string;
  /** Custom id for the path element. Auto-generated if omitted */
  id?: string;
}

/** Simple hash for auto-generating path IDs */
function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return "tp" + Math.abs(h).toString(36);
}

export function textPath(text: string, pathD: string, opts?: TextPathOptions): string {
  const id = opts?.id ?? hashId(pathD);
  const offset = opts?.offset ?? 0;
  const fontSize = opts?.fontSize ?? 48;
  const fill = opts?.fill ?? "white";
  const fontFamily = opts?.fontFamily ?? "inherit";
  const fontWeight = opts?.fontWeight ?? "normal";
  const letterSpacing = opts?.letterSpacing ?? "normal";

  return [
    `<defs><path id="${id}" d="${pathD}" fill="none"/></defs>`,
    `<text font-size="${fontSize}" fill="${fill}" font-family="${fontFamily}" font-weight="${fontWeight}" letter-spacing="${letterSpacing}">`,
    `  <textPath href="#${id}" startOffset="${Math.round(offset * 100) / 100}%">${text}</textPath>`,
    `</text>`,
  ].join("\n");
}
