import { afterEach, expect, it, vi } from "vitest";
import { captureBrowserArtifactWithEvidence } from "./capture-artifact.js";

const state = vi.hoisted(() => ({ capture: vi.fn(), context: vi.fn(() => ({ name: "context" })) }));
vi.mock("@zumer/snapdom", () => ({ snapdom: state.capture }));
vi.mock("@zumer/snapdom-plugins/context-export", () => ({ contextExport: state.context }));
afterEach(() => { vi.clearAllMocks(); });

function png(): Blob {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(bytes.buffer).setUint32(16, 4);
  new DataView(bytes.buffer).setUint32(20, 3);
  return new Blob([bytes], { type: "image/png" });
}

it("pairs export-time warnings, exact sizing, geometry and bounded frozen context", async () => {
  const warnings: { code: string; message: string; detail?: unknown }[] = [];
  const meta = { w0: 4, h0: 3, vbW: 8, vbH: 5, targetW: 4, targetH: 3, contentX: 3, contentY: 1, clip: { x: 2, y: 1, width: 4, height: 3 } };
  const context = { root: { tag: "div", text: "Before", children: [{ tag: "button", text: "Save" }] }, truncated: false, nodes: 2 };
  const blob = png();
  state.capture.mockResolvedValue({ warnings, meta, toContext: async () => context, toBlob: async () => { warnings.push({ code: "image-fallback", message: "Missing hero", detail: { src: "hero.png" } }); return blob; } });
  const result = await captureBrowserArtifactWithEvidence(document.createElement("div"), { width: 4, height: 3, dpr: 1 });
  expect(result.output).toBe(blob);
  expect(result.evidence).toMatchObject({ warnings: [{ code: "image-fallback", detail: { src: "hero.png" } }], geometry: { contentX: 3 }, requested: { width: 4, height: 3, dpr: 1 }, actual: { width: 4, height: 3 }, context: { root: { text: "Before" } } });
  expect(state.context).toHaveBeenCalledWith({ format: "json", maxNodes: 800, maxTextLength: 120, geometry: true, needs: "render" });
  warnings[0]!.message = "Changed";
  meta.clip.x = 90;
  context.root.children[0]!.text = "After";
  expect(result.evidence.warnings[0]!.message).toBe("Missing hero");
  expect(result.evidence.geometry?.clip?.x).toBe(2);
  expect(result.evidence.context?.root?.children?.[0]?.text).toBe("Save");
  expect(Object.isFrozen(result.evidence.context?.root?.children)).toBe(true);
  expect(result.evidence.timings.totalMs).toBeGreaterThanOrEqual(0);
});

it("retains a clean capture and reports truncated context honestly", async () => {
  state.capture.mockResolvedValue({ warnings: [], meta: undefined, toContext: async () => ({ root: null, truncated: true, nodes: 800 }), toBlob: async () => png() });
  const result = await captureBrowserArtifactWithEvidence(document.createElement("div"), { width: 4, height: 3, dpr: 1 });
  expect(result.evidence).toMatchObject({ warnings: [], geometry: null, context: { truncated: true, nodes: 800 } });
});

it("owns requested options before yielding and snapshots warnings after context export", async () => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let entered!: () => void;
  const capturing = new Promise<void>(resolve => { entered = resolve; });
  const warnings: { code: string; message: string }[] = [];
  const toBlob = vi.fn(async () => png());
  state.capture.mockImplementationOnce(async () => {
    entered(); await pending;
    return { warnings, meta: undefined, toBlob, toContext: async () => {
      warnings.push({ code: "context-degraded", message: "Late context warning" });
      return { root: null, nodes: 0, truncated: false };
    } };
  });
  const options = { width: 10, height: 8, dpr: 1, format: "png" as "png" | "jpeg", region: { x: 1, y: 2, width: 4, height: 3 } };
  const capture = captureBrowserArtifactWithEvidence(document.createElement("div"), options);
  await capturing;
  options.width = 90; options.dpr = 3; options.format = "jpeg"; options.region.x = 80; options.region.width = 99;
  release();
  const result = await capture;
  expect(toBlob).toHaveBeenCalledWith({ format: "png" });
  expect(result.evidence.requested).toEqual({ width: 10, height: 8, dpr: 1, scale: 1, region: { x: 1, y: 2, width: 4, height: 3 } });
  expect(result.evidence.warnings).toEqual([{ code: "context-degraded", message: "Late context warning" }]);
  expect(state.capture.mock.calls.at(-1)?.[1]).toMatchObject({ width: 4, height: 3, dpr: 1, clip: { x: 1, y: 2, width: 4, height: 3 } });
});
