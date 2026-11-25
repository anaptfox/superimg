import { expect, it } from "vitest";
import { PlaywrightEngine } from "@superimg/playwright/engine";
import { inspectArrangementLayout } from "./arrangement-layout.js";

it("measures chip wrapping in Chromium across landscape, square and portrait canvases", async () => {
  const engine = new PlaywrightEngine();
  await engine.init();
  try {
    for (const [width, height] of [[640, 360], [480, 480], [360, 640]] as const) {
      const html = '<div data-si-node="chip-label-origin" style="font:24px Arial;width:70px">origin zero</div><div data-si-node="chip-label-unit" style="font:24px Arial;width:250px">Time: seconds</div><div data-si-node="regular-caption" style="font:24px Arial;width:70px">allowed wrapping</div>';
      const observation = await engine.inspectFrame(html, { width, height, format: "png" });
      const findings = inspectArrangementLayout({ renderedLayout: [observation] }, 4);
      expect(findings).toEqual([expect.objectContaining({ code: "CHIP_TEXT_WRAPPED", details: expect.objectContaining({ nodeId: "chip-label-origin", frame: 4, observedLines: 2 }) })]);
    }
    const clipped = await engine.inspectFrame('<div data-si-node="chip-frame" style="width:60px;overflow:hidden;white-space:nowrap"><span data-si-node="chip-label-clipped" style="font:24px Arial">Long chip label</span></div>', { width: 320, height: 180, format: "png" });
    expect(inspectArrangementLayout({ renderedLayout: [clipped] }, 5)).toContainEqual(expect.objectContaining({ code: "CHIP_TEXT_CLIPPED", details: expect.objectContaining({ nodeId: "chip-label-clipped", ancestorId: "chip-frame", clippedX: true }) }));
    const ordinary = await engine.inspectFrame('<div id="caption" style="width:60px;overflow:hidden;white-space:nowrap;font:24px Arial">Long caption</div><div id="intentional" data-si-allow-text-clipping="true" style="width:60px;overflow:hidden;white-space:nowrap;font:24px Arial">Long caption</div>', { width: 320, height: 180, format: "png" });
    const ordinaryFindings = inspectArrangementLayout({ renderedLayout: [ordinary] }, 6);
    expect(ordinaryFindings).toContainEqual(expect.objectContaining({ code: "TEXT_CLIPPED", details: expect.objectContaining({ nodeId: "caption", ancestorId: "caption", clippedX: true }) }));
    expect(ordinaryFindings.some(finding => finding.details?.nodeId === "intentional")).toBe(false);
    const masked = await engine.inspectFrame('<div style="clip-path:circle(10px)"><span id="masked-label" style="font:24px Arial">Clipped text</span></div>', { width: 320, height: 180, format: "png" });
    expect(inspectArrangementLayout({ renderedLayout: [masked] }, 6)).toContainEqual(expect.objectContaining({ code: "TEXT_OVERFLOW_UNVERIFIED", details: expect.objectContaining({ nodeId: "masked-label" }) }));
  } finally { await engine.dispose(); }
}, 30000);

it("detects a top-quarter aligned diagram and accepts the repaired envelope in each edition", async () => {
  const engine = new PlaywrightEngine();
  await engine.init();
  try {
    for (const [width, height] of [[640, 360], [480, 480], [360, 640]] as const) {
      for (const [bottom, expected] of [[.20, true], [.45, true], [.70, false]] as const) {
        const html = `<div style="position:relative;width:${width}px;height:${height}px"><span id="chip-label-unit" style="position:absolute;top:${height * .05}px">Time</span><div id="plot-a" style="position:absolute;left:20px;top:${height * .1}px;width:100px;height:${height * .05}px"></div><div id="plot-b" style="position:absolute;left:20px;top:${height * bottom}px;width:100px;height:${height * .05}px"></div></div>`;
        const observation = await engine.inspectFrame(html, { width, height, format: "png" });
        const findings = inspectArrangementLayout({ renderedLayout: [{ ...observation, width, height }] }, 7);
        expect(findings.some(finding => finding.code === "SPARSE_ARRANGEMENT")).toBe(expected);
      }
    }
  } finally { await engine.dispose(); }
}, 30000);
