//! Conservative rendered contrast from a matched text-visible/text-hidden pair.
import sharp from "sharp";
import type { RuntimeFinding } from "@superimg/types";

type Node = { id?: unknown; tag?: unknown; text?: unknown; textLineCount?: unknown; parentIndex?: unknown; bounds?: unknown; clipping?: unknown; typography?: unknown };
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const luminance = (r: number, g: number, b: number) => {
  const linear = (n: number) => { const x = n / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; };
  return .2126 * linear(r) + .7152 * linear(g) + .0722 * linear(b);
};
const ratio = (a: number, b: number) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
const textTags = ["span", "p", "h1", "h2", "h3", "label", "text", "tspan"];

/** Unsupported or unavailable pixel measurements must remain visible to callers. */
export function unverifiedArrangementContrast(metadata: unknown, measured: ReadonlySet<string>, existing: readonly RuntimeFinding[], frame: number): RuntimeFinding[] {
  const observations = object(metadata).renderedLayout;
  if (!Array.isArray(observations) || observations.length === 0) return [{ code: "RENDERED_CONTRAST_UNVERIFIED", severity: "warning", category: "render", message: "Rendered text contrast could not be measured because browser observations are unavailable.", details: { nodeId: "arrangement", frame } }];
  const known = new Set(existing.filter(finding => finding.code === "TEXT_PAINT_UNVERIFIED" || finding.code === "RENDERED_CONTRAST_UNVERIFIED").map(finding => typeof finding.details?.nodeId === "string" ? finding.details.nodeId : ""));
  const findings: RuntimeFinding[] = [];
  for (const observation of observations) {
    const record = object(observation);
    if (object(record.coverage).truncated === true && !known.has("arrangement")) {
      findings.push({ code: "RENDERED_CONTRAST_UNVERIFIED", severity: "warning", category: "render", message: "Rendered text contrast coverage is incomplete because browser observations were truncated.", details: { nodeId: "arrangement", frame } });
      known.add("arrangement");
    }
    if (!Array.isArray(record.nodes)) continue;
    for (const raw of record.nodes) {
      const node = object(raw);
      if (typeof node.id !== "string" || typeof node.text !== "string" || !node.text.length || measured.has(node.id) || known.has(node.id)) continue;
      findings.push({ code: "RENDERED_CONTRAST_UNVERIFIED", severity: "warning", category: "render", message: "Rendered text contrast could not be measured from a matching supported pixel capture.", details: { nodeId: node.id, frame } });
      known.add(node.id);
    }
  }
  return findings;
}

export async function inspectArrangementContrast(input: { published: Uint8Array; visible: Uint8Array; background: Uint8Array; metadata: unknown; width: number; height: number; frame: number }): Promise<{ findings: RuntimeFinding[]; measured: Set<string> }> {
  const measured = new Set<string>();
  const findings: RuntimeFinding[] = [];
  const decode = async (bytes: Uint8Array) => sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [published, visible, background] = await Promise.all([decode(input.published), decode(input.visible), decode(input.background)]);
  if (published.info.channels !== 4 || visible.info.channels !== 4 || background.info.channels !== 4 || published.info.width !== visible.info.width || published.info.height !== visible.info.height || background.info.width !== visible.info.width || background.info.height !== visible.info.height || !published.data.equals(visible.data)) return { findings, measured };
  const sx = visible.info.width / input.width, sy = visible.info.height / input.height;
  if (!Number.isFinite(sx) || sx <= 0 || Math.abs(sx - sy) > 1e-6) return { findings, measured };
  const observations = object(input.metadata).renderedLayout;
  if (!Array.isArray(observations)) return { findings, measured };
  for (const observation of observations) {
    const record = object(observation), coverage = object(record.coverage);
    if (coverage.truncated === true || !Array.isArray(record.nodes)) continue;
    const nodes = record.nodes as Node[];
    const texts = nodes.filter(node => typeof node.id === "string" && typeof node.tag === "string" && textTags.includes(node.tag) && typeof node.text === "string" && node.text.length > 0);
    for (const node of texts) {
      if (typeof node.id !== "string" || typeof node.textLineCount !== "number" || node.textLineCount < 1) continue;
      const bounds = object(node.bounds), style = object(node.typography);
      const svg = node.tag === "text" || node.tag === "tspan";
      const colour = svg ? style.fill : style.color;
      if (![bounds.x, bounds.y, bounds.width, bounds.height].every(n => typeof n === "number" && Number.isFinite(n)) || typeof colour !== "string" || !/^rgb\(/i.test(colour) || (svg && (style["fill-opacity"] !== "1" || (style.stroke !== "none" && style.stroke !== ""))) || (!svg && ((style["-webkit-text-fill-color"] !== undefined && style["-webkit-text-fill-color"] !== colour) || (style.firstLetterColor !== undefined && style.firstLetterColor !== colour) || (style.firstLineColor !== undefined && style.firstLineColor !== colour))) || (style["text-shadow"] !== undefined && style["text-shadow"] !== "none") || (style["text-decoration-line"] !== undefined && style["text-decoration-line"] !== "none") || (style["-webkit-text-stroke-width"] !== undefined && style["-webkit-text-stroke-width"] !== "0px")) continue;
      const x = Math.floor((bounds.x as number) * sx), y = Math.floor((bounds.y as number) * sy), right = Math.ceil(((bounds.x as number) + (bounds.width as number)) * sx), bottom = Math.ceil(((bounds.y as number) + (bounds.height as number)) * sy);
      if (x < 0 || y < 0 || right > visible.info.width || bottom > visible.info.height || right <= x || bottom <= y) continue;
      // Overlapping labels cannot be attributed to an individual text node.
      if (texts.some(other => { if (other === node) return false; const b = object(other.bounds); return typeof b.x === "number" && typeof b.y === "number" && typeof b.width === "number" && typeof b.height === "number" && b.x < (bounds.x as number) + (bounds.width as number) && b.x + b.width > (bounds.x as number) && b.y < (bounds.y as number) + (bounds.height as number) && b.y + b.height > (bounds.y as number); })) continue;
      let index: unknown = nodes.indexOf(node), safe = true; const visited = new Set<number>();
      while (typeof index === "number" && index >= 0 && index < nodes.length && !visited.has(index)) {
        visited.add(index); const part = nodes[index]!; const css = object(part.clipping);
        if ((css.opacity !== undefined && css.opacity !== "1") || (css.visibility !== undefined && css.visibility !== "visible") || (css.display !== undefined && css.display === "none") || (css.filter !== undefined && css.filter !== "none") || (css["mix-blend-mode"] !== undefined && css["mix-blend-mode"] !== "normal") || (css["mask-image"] !== undefined && css["mask-image"] !== "none") || (css["clip-path"] !== undefined && css["clip-path"] !== "none")) { safe = false; break; }
        index = part.parentIndex;
      }
      if (!safe) continue;
      const first = (y * visible.info.width + x) * 4;
      const bg = background.data.subarray(first, first + 4);
      if (bg[3] !== 255) continue;
      let uniform = true, changed = false, maxRatio = 1;
      const bgLum = luminance(bg[0]!, bg[1]!, bg[2]!);
      for (let row = y; row < bottom && uniform; row++) for (let col = x; col < right; col++) {
        const i = (row * visible.info.width + col) * 4;
        if (background.data[i] !== bg[0] || background.data[i + 1] !== bg[1] || background.data[i + 2] !== bg[2] || background.data[i + 3] !== 255 || visible.data[i + 3] !== 255) { uniform = false; break; }
        if (visible.data[i] !== bg[0] || visible.data[i + 1] !== bg[1] || visible.data[i + 2] !== bg[2]) changed = true;
        maxRatio = Math.max(maxRatio, ratio(luminance(visible.data[i]!, visible.data[i + 1]!, visible.data[i + 2]!), bgLum));
      }
      if (!uniform) continue; // Gradients, images, overlapping paint and alpha stay unverified.
      measured.add(node.id);
      const minimum = 4.5;
      const pass = changed && maxRatio >= minimum;
      findings.push({ code: !changed ? "TEXT_NOT_VISIBLE" : pass ? "TEXT_CONTRAST_MEASURED" : "LOW_CONTRAST_TEXT", severity: pass ? "info" : "error", category: "render", message: !changed ? "The text made no visible change to its matched background." : `Rendered text reaches ${maxRatio.toFixed(2)}:1 contrast against its matched background${pass ? "." : ` (< ${minimum}:1).`}`, details: { nodeId: node.id, frame: input.frame, ratio: maxRatio, minimum, evidence: "matched-rendered-pixels" } });
    }
  }
  return { findings, measured };
}
