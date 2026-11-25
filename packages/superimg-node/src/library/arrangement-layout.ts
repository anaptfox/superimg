import type { RuntimeFinding } from "@superimg/types";

/** Chip labels have a one-line contract; named text must fit its clipping ancestors. */
export function inspectArrangementLayout(metadata: unknown, frame: number): RuntimeFinding[] {
  const root = metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {};
  const observations = Array.isArray(root.renderedLayout) ? root.renderedLayout : [];
  const findings: RuntimeFinding[] = [];
  for (const observation of observations) {
    if (!observation || typeof observation !== "object") continue;
    const record = observation as Record<string, unknown>;
    const nodes = Array.isArray(record.nodes) ? record.nodes : [];
    for (const raw of nodes) {
      if (!raw || typeof raw !== "object") continue;
      const node = raw as Record<string, unknown>;
      if (typeof node.id !== "string") continue;
      const chip = node.id.startsWith("chip-label-");
      if (!chip && !(typeof node.text === "string" && node.text.length > 0)) continue;
      if (chip) {
        const count = node.textLineCount;
        if (typeof count !== "number" || !Number.isInteger(count) || count < 1) {
          findings.push({ code: "CHIP_WRAP_UNVERIFIED", severity: "warning", category: "render", message: "The chip's text lines could not be measured.", details: { nodeId: node.id, frame } });
        } else if (count > 1) {
          findings.push({ code: "CHIP_TEXT_WRAPPED", severity: "error", category: "render", message: `Chip text wraps onto ${count} lines; one line was intended.`, details: { nodeId: node.id, frame, observedLines: count, expectedLines: 1 } });
        }
      }
      if (node.textClippingAllowed === true) continue;
      const box = node.textBounds && typeof node.textBounds === "object" ? node.textBounds as Record<string, unknown> : chip && node.bounds && typeof node.bounds === "object" ? node.bounds as Record<string, unknown> : {};
      const rectangle = (value: Record<string, unknown>) => [value.x, value.y, value.width, value.height].every(item => typeof item === "number" && Number.isFinite(item));
      if (!rectangle(box) && typeof node.text === "string" && node.text.length > 0) findings.push({ code: "TEXT_OVERFLOW_UNVERIFIED", severity: "warning", category: "render", message: "The text bounds could not be measured for clipping.", details: { nodeId: node.id, frame } });
      let parent: unknown = nodes.indexOf(raw);
      const visited = new Set<number>();
      let complexClipReported = false;
      while (rectangle(box) && typeof parent === "number" && Number.isInteger(parent) && parent >= 0 && parent < nodes.length && !visited.has(parent)) {
        visited.add(parent);
        const rawParent = nodes[parent];
        if (!rawParent || typeof rawParent !== "object") break;
        const ancestor = rawParent as Record<string, unknown>;
        const clip = ancestor.clipping && typeof ancestor.clipping === "object" ? ancestor.clipping as Record<string, unknown> : {};
        const bounds = ancestor.bounds && typeof ancestor.bounds === "object" ? ancestor.bounds as Record<string, unknown> : {};
        const clips = (value: unknown) => typeof value === "string" && ["hidden", "clip", "scroll", "auto"].includes(value);
        if (!complexClipReported && [clip["clip-path"], clip["mask-image"]].some(value => typeof value === "string" && value !== "" && value !== "none")) {
          findings.push({ code: "TEXT_OVERFLOW_UNVERIFIED", severity: "warning", category: "render", message: "Text clipping by a mask or nonrectangular clip could not be measured.", details: { nodeId: node.id, frame, ancestorId: typeof ancestor.id === "string" ? ancestor.id : "anonymous" } });
          complexClipReported = true;
        }
        if (rectangle(bounds)) {
          const x = box.x as number, y = box.y as number, width = box.width as number, height = box.height as number;
          const ax = bounds.x as number, ay = bounds.y as number, aw = bounds.width as number, ah = bounds.height as number;
          const clippedX = clips(clip["overflow-x"]) && (x < ax - 1 || x + width > ax + aw + 1);
          const clippedY = clips(clip["overflow-y"]) && (y < ay - 1 || y + height > ay + ah + 1);
          if (clippedX || clippedY) {
            findings.push({ code: chip ? "CHIP_TEXT_CLIPPED" : "TEXT_CLIPPED", severity: "error", category: "render", message: chip ? "The chip label extends beyond a clipping ancestor." : "The text extends beyond a clipping container.", details: { nodeId: node.id, frame, ancestorId: typeof ancestor.id === "string" ? ancestor.id : "anonymous", clippedX, clippedY } });
            break;
          }
        }
        parent = ancestor.parentIndex;
      }
    }
    // Aligned-interval diagrams own these part IDs. Their visual explanation
    // must span a useful portion of the selected edition's vertical stage;
    // this is an envelope check, not a universal ink-coverage requirement.
    const parts = nodes.filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object");
    const plots = parts.filter(node => typeof node.id === "string" && node.id.startsWith("plot-"));
    const chips = parts.some(node => typeof node.id === "string" && node.id.startsWith("chip-label-"));
    const coverage = record.coverage && typeof record.coverage === "object" ? record.coverage as Record<string, unknown> : {};
    if (plots.length >= 2 && chips && typeof record.height === "number" && record.height > 0 && coverage.truncated !== true) {
      const bounds = parts.filter(node => typeof node.id === "string" && /^(chip-label-|origin-marker$|t-|track-|plot-|overlap-|source$)/.test(node.id))
        .map(node => node.bounds && typeof node.bounds === "object" ? node.bounds as Record<string, unknown> : {})
        .filter(box => typeof box.y === "number" && Number.isFinite(box.y) && typeof box.height === "number" && Number.isFinite(box.height) && box.height > 0);
      if (bounds.length) {
        const top = Math.max(0, Math.min(...bounds.map(box => box.y as number)));
        const bottom = Math.min(record.height, Math.max(...bounds.map(box => (box.y as number) + (box.height as number))));
        const fraction = Math.max(0, bottom - top) / record.height;
        const bottomFraction = bottom / record.height;
        if (fraction < 0.3 || bottomFraction < 0.6) findings.push({ code: "SPARSE_ARRANGEMENT", severity: "error", category: "render", message: `Aligned interval content ends at ${(bottomFraction * 100).toFixed(1)}% of the frame height and spans ${(fraction * 100).toFixed(1)}%.`, details: { nodeId: "arrangement", frame, observedHeightFraction: fraction, minimumHeightFraction: 0.3, bottomFraction, minimumBottomFraction: 0.6 } });
      }
    }
  }
  return findings;
}
