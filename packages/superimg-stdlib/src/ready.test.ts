import { describe, expect, it } from "vitest";
import { ready, token, done, fail, WAIT_ATTR } from "./ready.js";
import { scene } from "./viz/three.js";
import { canvas } from "./viz/canvas.js";

describe("std.ready", () => {
  it("token attr and done share the same label", () => {
    const w = token("particles");
    expect(w.label).toBe("particles");
    expect(w.attr).toBe(`${WAIT_ATTR}="particles"`);
    expect(w.done).toContain("done");
    expect(w.done).toContain('"particles"');
    expect(w.fail("boom")).toContain("fail");
    expect(w.fail("boom")).toContain("boom");
  });

  it("done/fail helpers match token", () => {
    expect(done("x")).toBe(token("x").done);
    expect(fail("x", "e")).toBe(token("x").fail("e"));
  });

  it("rejects empty label", () => {
    expect(() => token("")).toThrow(/non-empty/);
    expect(() => token("   ")).toThrow(/non-empty/);
  });

  it("ready namespace re-exports", () => {
    expect(ready.token("a").label).toBe("a");
    expect(ready.WAIT_ATTR).toBe(WAIT_ATTR);
  });
});

describe("three.scene auto readiness", () => {
  it("stamps wait attr and done by default", () => {
    const html = scene({
      width: 100,
      height: 100,
      progress: 0.5,
      setup: "",
      animate: "",
    });
    expect(html).toContain("data-superimg-wait=");
    expect(html).toContain("__superimgReady");
    expect(html).toContain(".done(");
    expect(html).toContain("renderer.render");
  });

  it("uses custom wait label", () => {
    const html = scene({
      width: 10,
      height: 10,
      progress: 0,
      setup: "",
      animate: "",
      wait: "my-gl",
    });
    expect(html).toContain('data-superimg-wait="my-gl"');
    expect(html).toContain('"my-gl"');
  });

  it("can disable wait", () => {
    const html = scene({
      width: 10,
      height: 10,
      progress: 0,
      setup: "",
      animate: "",
      wait: false,
    });
    expect(html).not.toContain("data-superimg-wait");
  });
});

describe("canvas auto readiness", () => {
  it("stamps wait and done", () => {
    const html = canvas({ width: 32, height: 32, draw: "ctx.fillRect(0,0,1,1);" });
    expect(html).toContain("data-superimg-wait=");
    expect(html).toContain(".done(");
  });
});
