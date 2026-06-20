import katex from "katex";
import katexCssText from "./katex-css.generated.js";

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

/** KaTeX CSS string — embed as a <style> tag in your page shell for proper rendering */
export const css: string = katexCssText;
