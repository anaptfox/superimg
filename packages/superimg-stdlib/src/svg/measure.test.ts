import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseFontMetrics } from "./font-metrics.js";
import { createTextMeasurer, fitText, wrapText } from "./measure.js";
import { Frame, Text } from "../tree/primitives.js";
import { layoutTree } from "../tree/layout.js";
import { lower } from "../tree/lower.js";
import { isMediaElement } from "../tree/h.js";
import { typographyForPaint } from "../tree/typography.js";

const fonts = dirname(fileURLToPath(import.meta.url));
const inter = (weight: string) => parseFontMetrics(readFileSync(join(
  fonts,
  "../../../superimg-core/assets/fonts",
  `Inter-${weight}.ttf`,
)));

const measurer = createTextMeasurer([
  { family: "Inter", weight: 400, style: "normal", metrics: inter("400") },
  { family: "Inter", weight: 700, style: "normal", metrics: inter("700") },
]);

describe("createTextMeasurer", () => {
  it("makes Inter 700 wider than Inter 400 and rejects unknown families", () => {
    const regular = measurer.measure("Hello", { fontFamily: "Inter, system-ui, sans-serif", fontSize: 32, fontWeight: 400 });
    const bold = measurer.measure("Hello", { fontFamily: '"Inter"', fontSize: 32, fontWeight: 700 });
    expect(regular.exact).toBe(true);
    expect(bold.width).toBeGreaterThan(regular.width);
    const unknown = measurer.measure("Hello", { fontFamily: "Nope, serif", fontSize: 32 });
    expect(unknown.exact).toBe(false);
  });

  it("wraps the same string differently from the heuristic and keeps the lines", () => {
    const text = "The quick brown fox jumps over the lazy dog again";
    let differed = false;
    for (let width = 40; width < 900 && !differed; width += 8) {
      const heuristic = wrapText(text, width, { fontSize: 32, fontFamily: "Inter" });
      const exact = wrapText(text, width, {
        fontSize: 32,
        fontFamily: "Inter",
        fontWeight: 400,
        measurer,
      });
      differed = heuristic.lines.length !== exact.lines.length
        || heuristic.lines.some((line, index) => line.text !== exact.lines[index]?.text);
    }
    expect(differed).toBe(true);

    const tree = Frame({ width: 220, height: 400 }, Text({ size: 32, fontFamily: "Inter" }, text));
    const laid = layoutTree(tree, { measurer });
    const node = laid.children.find(isMediaElement);
    if (!node) throw new Error("expected text");
    const style = typographyForPaint(node, 220);
    expect(style.metricsExact).toBe(true);
    expect(style.lines!.length).toBeGreaterThan(1);
    const html = lower(tree, { width: 220, height: 400, measurer });
    expect(html).toContain("<br>");
    expect(html).toContain("white-space:pre");
  });
});

describe("nonbreaking units", () => {
  const exact = { measure: (text: string, request: { fontSize: number }) => ({ width: Array.from(text).length * request.fontSize, ascent: request.fontSize * 0.8, descent: request.fontSize * 0.2, exact: true }) };
  it.each(["\u00a0", "\u202f"])("preserves %j inside an unbreakable number and unit", (space) => {
    const unit = `5${space}fl${space}oz`;
    const lines = wrapText(`Take ${unit} now`, 45, { fontSize: 10, measurer: exact }).lines;
    expect(lines.map(line => line.text)).toEqual(["Take", unit, "now"]);
    expect(lines[1]!.width).toBe(70);
    expect(wrapText("Take 5 fl oz now", 45, { fontSize: 10, measurer: exact }).lines.map(line => line.text)).toEqual(["Take", "5 fl", "oz", "now"]);
    expect(fitText(unit, { width: 60, height: 100 }, { minSize: 10, maxSize: 10, measurer: exact }).lines).toEqual([]);
    expect(fitText("5 fl oz", { width: 60, height: 100 }, { minSize: 10, maxSize: 10, measurer: exact }).lines.length).toBeGreaterThan(0);
    const tree = Frame({ width: 45, height: 300 }, Text({ size: 10 }, `Take ${unit} now`));
    expect(lower(tree, { measurer: exact })).toContain(unit);
  });
});
