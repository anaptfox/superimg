import { expect, it, vi } from "vitest";
import { createRuntime, inspect } from "@superimg/core/runtime";
import { image, svg, collection, MEDIA_ELEMENT, type MediaElement } from "@superimg/types";
import type { PlaywrightEngine } from "@superimg/playwright/engine";
import { createNodeRuntimeAdapter } from "./adapter.js";

const observation = () => ({ coordinateSpace: "document-viewport" as const, nodes: [{ id: "card", occurrence: null, tag: "div", bounds: { x: 4, y: 8, width: 20, height: 10 }, text: "accepted", typography: null, svg: null }], coverage: { sampledNodes: 1, truncated: false, maxNodes: 800, maxTextLength: 120, opaque: [] } });
function engineFixture() {
  const inspectFrame = vi.fn(async (_html: string, _config: unknown, _options?: unknown) => observation());
  const init = vi.fn(async () => {});
  const dispose = vi.fn(async () => {});
  return { inspectFrame, init, dispose, createEngine: () => ({ inspectFrame, init, dispose }) as unknown as PlaywrightEngine };
}
const html = (text: string): MediaElement => ({ $$typeof: MEDIA_ELEMENT, type: "Html", props: { width: "fill", height: "fill", html: `<div data-si-node="card">${text}</div>` }, children: [] });

it("keeps ordinary inspection browser-free and uses fulfilled selection/data for opt-in layout", async () => {
  const fixture = engineFixture();
  const resolve = vi.fn(() => ({ data: { label: "resolved" } }));
  const media = image({ size: { width: 80, height: 40 }, sample: { label: "sample" }, variants: { alternate: { label: "variant" } }, editions: { square: { size: { width: 40, height: 40 } } }, resolve, render: ctx => html(ctx.data.label) });
  const runtime = createRuntime(createNodeRuntimeAdapter({ ...fixture, defaultFonts: false }));
  try {
    await inspect(runtime, media);
    expect(fixture.init).not.toHaveBeenCalled();
    resolve.mockClear();
    const report = await inspect(runtime, media, { renderedLayout: true, variantId: "alternate", editionId: "square" });
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(fixture.inspectFrame).toHaveBeenCalledWith(expect.stringContaining("resolved"), expect.objectContaining({ width: 40, height: 40 }), expect.objectContaining({ time: 0 }), {});
    expect(report.findings.some(finding => finding.code === "RENDERED_LAYOUT_UNAVAILABLE")).toBe(false);
    expect(report.metadata?.renderedLayout).toMatchObject([{ coordinates: { variantId: "alternate", editionId: "square" }, width: 40, height: 40, nodes: [{ id: "card" }] }]);
  } finally { await runtime.dispose(); }
  expect(fixture.dispose).toHaveBeenCalledOnce();
});

it("publishes captured diagnostics before propagating cancellation", async () => {
  const fixture = engineFixture();
  const controller = new AbortController();
  const onInspectionDiagnostics = vi.fn();
  const failure = Object.assign(new Error("host cancelled"), { inspectionDiagnostics: { scope: "operation-window", console: [] }, inspectionTrace: { kind: "playwright-trace-zip", path: "cancelled.zip", error: null } });
  fixture.inspectFrame.mockImplementationOnce(async () => { controller.abort(failure); throw failure; });
  const runtime = createRuntime(createNodeRuntimeAdapter({ ...fixture, defaultFonts: false, onInspectionDiagnostics }));
  try {
    await expect(inspect(runtime, image({ render: () => html("cancelled") }), { renderedLayout: true, signal: controller.signal })).rejects.toMatchObject({ code: "RUNTIME_CANCELLED" });
    expect(onInspectionDiagnostics).toHaveBeenCalledExactlyOnceWith({ diagnostics: failure.inspectionDiagnostics, trace: failure.inspectionTrace });
  } finally { await runtime.dispose(); }
});

it("discloses text truncation without claiming that the node limit was reached", async () => {
  const fixture = engineFixture();
  fixture.inspectFrame.mockResolvedValueOnce({ ...observation(), coverage: { ...observation().coverage, truncated: true } });
  const runtime = createRuntime(createNodeRuntimeAdapter({ ...fixture, defaultFonts: false }));
  try {
    const report = await inspect(runtime, image({ render: () => html("bounded") }), { renderedLayout: true });
    expect(report.findings).toContainEqual(expect.objectContaining({ code: "RENDERED_LAYOUT_TRUNCATED", severity: "warning", message: "Browser layout observation was truncated (limits: 800 nodes, 120 characters per text field)" }));
  } finally { await runtime.dispose(); }
});

it("defers providers even when browser layout was requested", async () => {
  const fixture = engineFixture();
  const entries = vi.fn(async () => [{ id: "one" }]);
  const media = collection({ entries, media: image<{ id: string }>({ render: () => html("entry") }) });
  const runtime = createRuntime(createNodeRuntimeAdapter({ ...fixture, defaultFonts: false }));
  try {
    await inspect(runtime, media, { renderedLayout: true });
    expect(entries).not.toHaveBeenCalled();
    expect(fixture.init).not.toHaveBeenCalled();
  } finally { await runtime.dispose(); }
});

it("inspects SVG through the operation-owned browser and converts failures into findings", async () => {
  const fixture = engineFixture();
  fixture.inspectFrame.mockRejectedValueOnce(new Error("Layout page failed"));
  const runtime = createRuntime(createNodeRuntimeAdapter({ ...fixture, defaultFonts: false }));
  const media = svg({ size: { width: 80, height: 40 }, render: () => ({ $$typeof: MEDIA_ELEMENT, type: "Vector", props: { width: 80, height: 40 }, children: [] }) as MediaElement });
  try {
    const report = await inspect(runtime, media, { renderedLayout: true });
    expect(fixture.inspectFrame.mock.calls[0]?.[0]).toContain("<svg");
    expect(report.findings).toContainEqual(expect.objectContaining({ code: "RENDERED_LAYOUT_FAILED", message: "Layout page failed" }));
  } finally { await runtime.dispose(); }
});
