import { expect, it } from "vitest";
import { PlaywrightEngine } from "@superimg/playwright/engine";
import { inspectArrangementContrast } from "./arrangement-contrast.js";

it("measures actual low and high contrast chip pixels with a matched hidden-text capture", async () => {
  const engine = new PlaywrightEngine();
  await engine.init();
  try {
    for (const [colour, expected] of [["#eeeeee", "LOW_CONTRAST_TEXT"], ["#111111", "TEXT_CONTRAST_MEASURED"]] as const) {
      const observation = await engine.inspectFrame(`<div style="background:#fff;width:320px;height:180px"><span id="chip-label-origin" style="font:28px Arial;color:${colour} !important;-webkit-text-fill-color:${colour} !important">origin 0</span></div>`, { width: 320, height: 180, format: "png", dpr: 1 }, undefined, { captureTextPair: true });
      expect(observation.paintPair).toBeDefined();
      const pair = observation.paintPair!;
      const result = await inspectArrangementContrast({ published: pair.visible, ...pair, metadata: { renderedLayout: [observation] }, width: 320, height: 180, frame: 0 });
      expect(result.findings).toContainEqual(expect.objectContaining({ code: expected, details: expect.objectContaining({ nodeId: "chip-label-origin", evidence: "matched-rendered-pixels" }) }));
    }
    for (const [size, expected, minimum] of [[16, "LOW_CONTRAST_TEXT", 4.5], [28, "LOW_CONTRAST_TEXT", 4.5]] as const) {
      const observation = await engine.inspectFrame(`<div style="background:#fff;width:320px;height:180px"><span id="contrast-size" style="font:${size}px Arial;color:#878787 !important;-webkit-text-fill-color:#878787 !important">Contrast</span></div>`, { width: 320, height: 180, format: "png", dpr: 1 }, undefined, { captureTextPair: true });
      const pair = observation.paintPair!;
      const result = await inspectArrangementContrast({ published: pair.visible, ...pair, metadata: { renderedLayout: [observation] }, width: 320, height: 180, frame: 0 });
      expect(result.findings).toContainEqual(expect.objectContaining({ code: expected, details: expect.objectContaining({ nodeId: "contrast-size", minimum }) }));
    }
    const svg = await engine.inspectFrame('<svg width="320" height="180"><rect width="320" height="180" fill="#fff"/><text id="svg-label" x="20" y="60" font-size="28" fill="#111">Readable</text></svg>', { width: 320, height: 180, format: "png", dpr: 1 }, undefined, { captureTextPair: true });
    expect(svg.paintPair).toBeDefined();
    const svgResult = await inspectArrangementContrast({ published: svg.paintPair!.visible, ...svg.paintPair!, metadata: { renderedLayout: [svg] }, width: 320, height: 180, frame: 0 });
    expect(svgResult.findings).toContainEqual(expect.objectContaining({ code: "TEXT_CONTRAST_MEASURED", details: expect.objectContaining({ nodeId: "svg-label" }) }));
  } finally { await engine.dispose(); }
}, 30000);
