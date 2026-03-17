import { describe, it, expect, vi } from "vitest";
import { compose } from "../composition/compose.js";
import { makeTestContext } from "./__test-utils__/index.js";

describe("compose", () => {
  it("scene transitions at exact frame boundary", () => {
    const scene1 = {
      config: { duration: 1 },
      render: () => "scene1",
    };
    const scene2 = {
      config: { duration: 1 },
      render: () => "scene2",
    };
    const composed = compose([scene1, scene2]);

    const ctx29 = makeTestContext({
      globalFrame: 29,
      fps: 30,
      totalFrames: 60,
    });
    const ctx30 = makeTestContext({
      globalFrame: 30,
      fps: 30,
      totalFrames: 60,
    });

    expect(composed.render(ctx29)).toBe("scene1");
    expect(composed.render(ctx30)).toBe("scene2");
  });

  it("sceneProgress is 0 at scene start, ~1 at scene end", () => {
    const scene = {
      config: { duration: 1 },
      render: (ctx: { sceneProgress: number }) => String(ctx.sceneProgress),
    };
    const composed = compose([scene]);

    const ctxStart = makeTestContext({
      globalFrame: 0,
      fps: 30,
      totalFrames: 30,
    });
    const ctxEnd = makeTestContext({
      globalFrame: 29,
      fps: 30,
      totalFrames: 30,
    });

    expect(parseFloat(composed.render(ctxStart))).toBe(0);
    expect(parseFloat(composed.render(ctxEnd))).toBe(1);
  });

  it("data merges with correct precedence: defaults < shared < CLI", () => {
    const scene = {
      defaults: { a: 1, b: 1, c: 1 },
      config: { duration: 1 },
      render: (ctx: { data: Record<string, number> }) =>
        JSON.stringify(ctx.data),
    };
    const composed = compose([scene], { b: 2, c: 2 });
    const ctx = makeTestContext({ data: { c: 3 } });

    expect(JSON.parse(composed.render(ctx))).toEqual({ a: 1, b: 2, c: 3 });
  });

  it("warns on dimension mismatch", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const scene1 = {
      config: { width: 1920, duration: 1 },
      render: () => "",
    };
    const scene2 = {
      config: { width: 1080, duration: 1 },
      render: () => "",
    };

    compose([scene1, scene2]);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Width conflict")
    );
    warn.mockRestore();
  });

  it("warns on FPS mismatch", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const scene1 = {
      config: { fps: 30, duration: 1 },
      render: () => "",
    };
    const scene2 = {
      config: { fps: 60, duration: 1 },
      render: () => "",
    };

    compose([scene1, scene2]);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("FPS conflict")
    );
    warn.mockRestore();
  });

  it("throws when scenes array is empty", () => {
    expect(() => compose([])).toThrow(/at least one scene/);
  });

  it("applies easing to transitions", () => {
    const scene = {
      config: { duration: 1 },
      render: () => "<div>content</div>",
    };
    const composed = compose([
      {
        template: scene,
        enter: { type: "fade", duration: "500ms", easing: "easeOutCubic" },
      },
    ]);

    // Render at frame 7 (7/30 = 0.233s into a 0.5s transition = ~47% progress)
    const ctx = makeTestContext({
      globalFrame: 7,
      fps: 30,
      totalFrames: 30,
    });

    const html = composed.render(ctx);
    // With easing, opacity should NOT match linear progress
    // easeOutCubic(0.47) ≈ 0.85, NOT 0.47
    expect(html).toContain("opacity:");
    const match = html.match(/opacity:([\d.]+)/);
    expect(match).not.toBeNull();
    const opacity = parseFloat(match![1]);
    // Linear would give ~0.47, easeOutCubic gives ~0.85
    expect(opacity).toBeGreaterThan(0.7);
  });
});
