import { expect, it } from "vitest";
import sharp from "sharp";
import { inspectArrangementContrast, unverifiedArrangementContrast } from "./arrangement-contrast.js";

const width = 20, height = 12;
const node = { id: "chip-label-origin", tag: "span", text: "origin", textLineCount: 1, bounds: { x: 2, y: 2, width: 12, height: 8 }, typography: { color: "rgb(30, 30, 30)" }, parentIndex: null, clipping: { opacity: "1", visibility: "visible", display: "inline", filter: "none", "mix-blend-mode": "normal", "mask-image": "none" } };
const metadata = { renderedLayout: [{ nodes: [node], coverage: { truncated: false } }] };
async function png(colour: number | null, gradient = false) {
  const data = Buffer.alloc(width * height * 4, 255);
  if (gradient) data[(3 * width + 3) * 4] = 100;
  if (colour !== null) for (let y = 4; y < 8; y++) for (let x = 5; x < 10; x++) { const i = (y * width + x) * 4; data[i] = colour; data[i + 1] = colour; data[i + 2] = colour; }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

it("uses matched published pixels and reports both readable and low-contrast text", async () => {
  const background = await png(null);
  for (const [colour, expected] of [[0, "TEXT_CONTRAST_MEASURED"], [230, "LOW_CONTRAST_TEXT"]] as const) {
    const visible = await png(colour);
    const result = await inspectArrangementContrast({ published: visible, visible, background, metadata, width, height, frame: 9 });
    expect(result.measured.has(node.id)).toBe(true);
    expect(result.findings).toContainEqual(expect.objectContaining({ code: expected, details: expect.objectContaining({ nodeId: node.id, frame: 9, evidence: "matched-rendered-pixels" }) }));
  }
});

it("leaves mismatched captures, gradients and overlapping labels unverified", async () => {
  const visible = await png(0), background = await png(null);
  const mismatch = await inspectArrangementContrast({ published: await png(20), visible, background, metadata, width, height, frame: 0 });
  expect(mismatch.measured.size).toBe(0);
  const gradient = await inspectArrangementContrast({ published: visible, visible, background: await png(null, true), metadata, width, height, frame: 0 });
  expect(gradient.measured.size).toBe(0);
  const overlap = await inspectArrangementContrast({ published: visible, visible, background, metadata: { renderedLayout: [{ nodes: [node, { ...node, id: "chip-label-unit" }] }] }, width, height, frame: 0 });
  expect(overlap.measured.size).toBe(0);
});

it("requires 4.5:1 for measured text regardless of size or weight", async () => {
  const visible = await png(135), background = await png(null);
  for (const [size, weight, expected, minimum] of [["16px", "400", "LOW_CONTRAST_TEXT", 4.5], ["24px", "400", "LOW_CONTRAST_TEXT", 4.5], ["19px", "700", "LOW_CONTRAST_TEXT", 4.5], ["19px", "400", "LOW_CONTRAST_TEXT", 4.5]] as const) {
    const result = await inspectArrangementContrast({ published: visible, visible, background, metadata: { renderedLayout: [{ nodes: [{ ...node, typography: { ...node.typography, "font-size": size, "font-weight": weight } }] }] }, width, height, frame: 0 });
    expect(result.findings).toContainEqual(expect.objectContaining({ code: expected, details: expect.objectContaining({ minimum }) }));
  }
});

it("reports unsupported pixel observations once and preserves existing unverified findings", () => {
  expect(unverifiedArrangementContrast(metadata, new Set(), [], 9)).toEqual([expect.objectContaining({ code: "RENDERED_CONTRAST_UNVERIFIED", severity: "warning", details: { nodeId: node.id, frame: 9 } })]);
  expect(unverifiedArrangementContrast(metadata, new Set([node.id]), [], 9)).toEqual([]);
  expect(unverifiedArrangementContrast(metadata, new Set(), [{ code: "TEXT_PAINT_UNVERIFIED", severity: "warning", category: "render", message: "not measured", details: { nodeId: node.id } }], 9)).toEqual([]);
  expect(unverifiedArrangementContrast({ renderedLayout: [{ nodes: [{ ...node, id: "plain-label", tag: "div" }] }] }, new Set(), [], 9)).toContainEqual(expect.objectContaining({ code: "RENDERED_CONTRAST_UNVERIFIED", details: { nodeId: "plain-label", frame: 9 } }));
  expect(unverifiedArrangementContrast(undefined, new Set(), [], 9)).toContainEqual(expect.objectContaining({ code: "RENDERED_CONTRAST_UNVERIFIED", details: { nodeId: "arrangement", frame: 9 } }));
});
