import { describe, expect, it } from "vitest";
import { NativeSurface } from "./native-surface.js";
import { lower } from "./lower.js";
import { collectSceneDescriptions, resolveSceneTree } from "./scene.js";

const module = { identity: "v1", moduleUrl: "/module.js", bridgeUrl: "/bridge.js" };
describe("NativeSurface data boundary", () => {
  it("allows a deliberate readiness opt-out without changing the default", () => {
    const input = { id: "art", module, width: 10, height: 10, seconds: 0, data: {} };
    expect(lower(NativeSurface(input))).toContain('data-superimg-wait="native-art"');
    expect(lower(NativeSurface({ ...input, wait: "custom-ready" }))).toContain('data-superimg-wait="custom-ready"');
    expect(lower(NativeSurface({ ...input, wait: false }))).not.toContain("data-superimg-wait=");
    expect(() => NativeSurface({ ...input, wait: '\"><script>' })).toThrow(/readiness label/);
  });
  it("retains host-authored semantic observations on the boxed surface", () => {
    const surface = NativeSurface({ id: "art", module, width: 10, height: 10, seconds: 0, data: {}, semantic: { kind: "scene", label: "Two mugs", metadata: { shot: "wide" } } });
    expect(surface.props.semantic).toEqual({ kind: "scene", label: "Two mugs", metadata: { shot: "wide" } });
    expect(collectSceneDescriptions(resolveSceneTree(surface))).toEqual(expect.arrayContaining([expect.objectContaining({ nodes: expect.arrayContaining([expect.objectContaining({ id: "media/art", label: "Two mugs", metadata: { shot: "wide" } })]) })]));
  });
  it("escapes script-sensitive data and accepts shared JSON values", () => {
    const shared = { title: "</script><script>bad</script>" };
    const markup = lower(NativeSurface({ id: "art", module, width: 10, height: 10, seconds: 0, data: { first: shared, second: shared } }));
    expect(markup).not.toContain("</script><script>bad</script>");
    expect(markup).toContain("\\u003c/script>");
  });
  it("rejects values JSON would silently omit or coerce", () => {
    const cycle: { self?: unknown } = {}; cycle.self = cycle;
    for (const data of [{ x: undefined }, { x: NaN }, { x: () => {} }, [1, , 2], cycle, new Date()]) {
      expect(() => NativeSurface({ id: "art", module, width: 10, height: 10, seconds: 0, data })).toThrow();
    }
  });
});
