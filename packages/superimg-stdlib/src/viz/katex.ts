import katex from "katex";
import katexCssText from "./katex-css.generated.js";
import { clamp01 } from "../easing.js";
import { lagProgress } from "./reveal.js";

export interface KatexOptions {
  displayMode?: boolean;
  fontSize?: number | string;
  color?: string;
  style?: string;
  progress?: number;
}

export function equation(latex: string, opts: KatexOptions = {}): string {
  const {
    displayMode = false,
    fontSize,
    color,
    style = "",
    progress = 1,
  } = opts;

  const rendered = katex.renderToString(latex, {
    displayMode,
    throwOnError: false,
    output: "html",
  });

  const parts: string[] = [];
  if (fontSize != null) parts.push(`font-size:${typeof fontSize === "number" ? `${fontSize}px` : fontSize}`);
  if (color) parts.push(`color:${color}`);
  if (progress !== 1) parts.push(`opacity:${progress}`);
  if (style) parts.push(style);

  const styleStr = parts.join(";");
  return `<span style="${styleStr}">${rendered}</span>`;
}

export interface EquationStep {
  /** Stable key for match-crossfade (Manim TransformMatchingTex analogue, DOM-level). */
  key: string;
  /** LaTeX body for this part (no {{ }} wrappers). */
  latex: string;
}

export interface EquationStepsOpts extends KatexOptions {
  /**
   * Global reveal progress 0–1.
   * With lag, each step fades in sequentially without lengthening total time.
   */
  progress?: number;
  /** Lag across steps (default 0.2). */
  lag?: number;
  /** Gap between steps in CSS (default 0.15em). */
  gap?: string;
}

/**
 * Parse `a + {{b}} = {{c}}` into ordered steps with keys.
 * Unwrapped text becomes sequential keys `_0`, `_1`, …
 */
export function parseEquationSteps(template: string): EquationStep[] {
  const steps: EquationStep[] = [];
  const re = /\{\{\s*([^}]+?)\s*\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let anon = 0;
  while ((m = re.exec(template)) !== null) {
    if (m.index > last) {
      const plain = template.slice(last, m.index);
      if (plain.trim()) steps.push({ key: `_${anon++}`, latex: plain });
    }
    const inner = m[1]!.trim();
    steps.push({ key: inner, latex: inner });
    last = m.index + m[0].length;
  }
  if (last < template.length) {
    const plain = template.slice(last);
    if (plain.trim()) steps.push({ key: `_${anon++}`, latex: plain });
  }
  return steps;
}

/**
 * Keyed equation parts with lag reveal / match-crossfade support.
 *
 * @example
 * // Reveal pieces with lag
 * std.viz.equationSteps("E = {{mc^2}}", { progress: d.in("main"), lag: 0.25 })
 *
 * // Match-transform: same keys fade between from/to layouts via dual calls + opacity
 */
export function equationSteps(
  templateOrSteps: string | EquationStep[],
  opts: EquationStepsOpts = {},
): string {
  const steps =
    typeof templateOrSteps === "string"
      ? parseEquationSteps(templateOrSteps)
      : templateOrSteps;
  if (!steps.length) return "";

  const progress = opts.progress ?? 1;
  const lag = opts.lag ?? 0.2;
  const gap = opts.gap ?? "0.15em";
  const displayMode = opts.displayMode ?? false;

  const parts = steps.map((step, i) => {
    const local = lagProgress(progress, i, steps.length, lag);
    const html = katex.renderToString(step.latex, {
      displayMode,
      throwOnError: false,
      output: "html",
    });
    const styleParts: string[] = [
      `display:inline-block`,
      `opacity:${local.toFixed(3)}`,
      `transform:translateY(${((1 - local) * 8).toFixed(1)}px)`,
    ];
    if (opts.fontSize != null) {
      styleParts.push(
        `font-size:${typeof opts.fontSize === "number" ? `${opts.fontSize}px` : opts.fontSize}`,
      );
    }
    if (opts.color) styleParts.push(`color:${opts.color}`);
    if (opts.style) styleParts.push(opts.style);
    return `<span data-eq-key="${escapeAttr(step.key)}" style="${styleParts.join(";")}">${html}</span>`;
  });

  const wrap: string[] = [`display:inline-flex`, `align-items:baseline`, `gap:${gap}`];
  if (opts.displayMode) wrap.push(`justify-content:center`, `width:100%`);
  return `<span style="${wrap.join(";")}">${parts.join("")}</span>`;
}

/**
 * Crossfade two equation step layouts that share keys (v1 match-transform).
 * Matched keys: opacity mix. Only-in-from: fade out. Only-in-to: fade in.
 */
export function equationMatch(
  fromTemplate: string | EquationStep[],
  toTemplate: string | EquationStep[],
  progress: number,
  opts: Omit<EquationStepsOpts, "progress" | "lag"> = {},
): string {
  const t = clamp01(progress);
  const from = typeof fromTemplate === "string" ? parseEquationSteps(fromTemplate) : fromTemplate;
  const to = typeof toTemplate === "string" ? parseEquationSteps(toTemplate) : toTemplate;
  const fromMap = new Map(from.map((s) => [s.key, s]));
  const toMap = new Map(to.map((s) => [s.key, s]));
  const keys = [...new Set([...fromMap.keys(), ...toMap.keys()])];

  const gap = opts.gap ?? "0.15em";
  const displayMode = opts.displayMode ?? false;

  const parts = keys.map((key) => {
    const a = fromMap.get(key);
    const b = toMap.get(key);
    let latex: string;
    let opacity: number;
    if (a && b) {
      // Prefer "to" latex once halfway; fade through
      latex = t < 0.5 ? a.latex : b.latex;
      opacity = 1;
    } else if (a) {
      latex = a.latex;
      opacity = 1 - t;
    } else {
      latex = b!.latex;
      opacity = t;
    }
    if (opacity <= 0.001) return "";
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: "html",
    });
    const styleParts = [
      `display:inline-block`,
      `opacity:${opacity.toFixed(3)}`,
    ];
    if (opts.fontSize != null) {
      styleParts.push(
        `font-size:${typeof opts.fontSize === "number" ? `${opts.fontSize}px` : opts.fontSize}`,
      );
    }
    if (opts.color) styleParts.push(`color:${opts.color}`);
    return `<span data-eq-key="${escapeAttr(key)}" style="${styleParts.join(";")}">${html}</span>`;
  });

  const wrap = [`display:inline-flex`, `align-items:baseline`, `gap:${gap}`];
  if (displayMode) wrap.push(`justify-content:center`, `width:100%`);
  return `<span style="${wrap.join(";")}">${parts.filter(Boolean).join("")}</span>`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** KaTeX CSS string — embed as a <style> tag in your page shell for proper rendering */
export const css: string = katexCssText;
