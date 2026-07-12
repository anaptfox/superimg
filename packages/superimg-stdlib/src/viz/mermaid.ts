/**
 * Mermaid diagrams for SuperImg — sync wrap of pre-rendered SVG only.
 *
 * Mermaid layout is async and needs a browser DOM — never call mermaid.render
 * inside pure render(ctx). Pre-render once (CLI/tool), pass the SVG string here,
 * then animate with director via progress / per-mark opacity.
 */

export interface MermaidHighlight {
  /** Node ids / class names to emphasize (matched as substring of id/class). */
  nodes?: string[];
  /** Edge data-id fragments to emphasize. */
  edges?: string[];
  /**
   * Marks that stay fully lit (already revealed). Cumulative walkthroughs should
   * put prior steps here so they don't dim when focus moves forward.
   */
  revealed?: string[];
  /** 0–1 ramp for the currently focusing marks. Default 1. */
  progress?: number;
}

export interface MermaidOpts {
  width?: number | string;
  height?: number | string;
  /** Overall opacity 0–1 for the whole diagram. */
  progress?: number;
  highlight?: MermaidHighlight;
  /** Opacity for marks not yet revealed / not active. Default 0.22. */
  dimOpacity?: number;
  className?: string;
}

function escapeCss(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function markRule(selector: string, opacity: number): string {
  return `${selector} { opacity: ${opacity.toFixed(3)} !important; }`;
}

/**
 * Wrap a pre-rendered Mermaid (or hand-authored) SVG for frame-accurate animation.
 *
 * Prefer cumulative `revealed` + current `nodes`/`edges` so walkthroughs don't jump.
 */
export function mermaid(svg: string, opts: MermaidOpts = {}): string {
  if (typeof svg !== "string" || !svg.trim()) {
    throw new Error("std.viz.mermaid: svg must be a non-empty pre-rendered SVG string");
  }
  const progress = Number.isFinite(opts.progress) ? Math.max(0, Math.min(1, opts.progress!)) : 1;
  const dim = opts.dimOpacity ?? 0.22;
  const hl = opts.highlight;
  const hlP =
    hl?.progress != null && Number.isFinite(hl.progress)
      ? Math.max(0, Math.min(1, hl.progress))
      : 1;
  const width =
    opts.width != null
      ? `width:${typeof opts.width === "number" ? `${opts.width}px` : opts.width};`
      : "";
  const height =
    opts.height != null
      ? `height:${typeof opts.height === "number" ? `${opts.height}px` : opts.height};`
      : "";
  const cls = opts.className ? ` class="${opts.className}"` : "";

  const activeNodes = hl?.nodes?.filter(Boolean) ?? [];
  const activeEdges = hl?.edges?.filter(Boolean) ?? [];
  const revealed = hl?.revealed?.filter(Boolean) ?? [];
  // Any highlight object means "walkthrough mode" — dim baseline even if nothing revealed yet
  const hasHl = hl !== undefined;

  let style = "";
  if (hasHl) {
    // Active marks ramp with hlP; revealed stay fully lit; rest stay dim.
    const activeOp = dim + (1 - dim) * hlP;
    const revealedOp = 1;
    const rules: string[] = [
      `.superimg-mermaid .node, .superimg-mermaid [data-edge], .superimg-mermaid .edgePath { opacity: ${dim.toFixed(3)} !important; }`,
    ];
    for (const n of revealed) {
      const e = escapeCss(n);
      rules.push(
        markRule(
          `.superimg-mermaid .node[id*="${e}"], .superimg-mermaid g[id*="${e}"]`,
          revealedOp,
        ),
      );
      // edges can also be named in revealed
      rules.push(
        markRule(
          `.superimg-mermaid [data-id*="${e}"], .superimg-mermaid .edgePath[id*="${e}"]`,
          revealedOp,
        ),
      );
    }
    for (const n of activeNodes) {
      const e = escapeCss(n);
      rules.push(
        markRule(
          `.superimg-mermaid .node[id*="${e}"], .superimg-mermaid g[id*="${e}"]`,
          activeOp,
        ),
      );
    }
    for (const e of activeEdges) {
      const esc = escapeCss(e);
      rules.push(
        markRule(
          `.superimg-mermaid [data-id*="${esc}"], .superimg-mermaid .edgePath[id*="${esc}"]`,
          activeOp,
        ),
      );
    }
    style = `<style>${rules.join("\n")}</style>`;
  }

  const cleaned = svg
    .replace(/animation\s*:[^;"}]+;?/gi, "")
    .replace(/@keyframes[\s\S]*?\{[\s\S]*?\}\s*\}/gi, "");

  return `<div${cls} class="superimg-mermaid" style="${width}${height}opacity:${progress.toFixed(3)};overflow:hidden;position:relative">${style}${cleaned}</div>`;
}
