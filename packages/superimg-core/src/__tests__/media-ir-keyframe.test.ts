import { describe, it, expect } from "vitest";
import { define, type JsonObject } from "@superimg/types";
import { resolveMediaIR } from "../ir/resolve-media-ir.js";
import { boxedHtml } from "./__test-utils__/index.js";

describe("Media IR motion keyframes", () => {
  it("records mirrored exit easing for easeOutCubic enter", async () => {
    const template = define<JsonObject>({
      config: { width: 100, height: 100, fps: 10, duration: "1s" },
      render(ctx) {
        const t = ctx.director({ enter: "30%", hold: "40%", exit: "30%" });
        t.motion({ id: "card.enter", y: 20, easing: "easeOutCubic", exit: true });
        return boxedHtml(`<div>x</div>`);
      },
    });
    const { ir } = await resolveMediaIR(template, { sourceId: "exit-easing" });
    const m = ir.motions.find((x) => x.localId === "card.enter");
    expect(m).toBeTruthy();
    expect(m!.easing).toEqual({ kind: "named", name: "easeOutCubic" });
    expect(m!.exitEasing).toEqual({ kind: "named", name: "easeInCubic" });
    expect(m!.exitTo).toBeTruthy();
  });

  it("marks non-linear tween pattern as sampled", async () => {
    const template = define<JsonObject>({
      config: { width: 80, height: 80, fps: 10, duration: "0.5s" },
      render(ctx) {
        const t = ctx.director({ main: "100%" });
        t.tween(0, 1, { id: "wiggle", pattern: "sine", during: "main" });
        return boxedHtml(`<div>x</div>`);
      },
    });
    const { ir } = await resolveMediaIR(template, { sourceId: "pattern" });
    const m = ir.motions.find((x) => x.localId === "wiggle");
    expect(m).toBeTruthy();
    expect(m!.kind).toBe("sampled");
    expect(m!.pattern).toBe("sine");
  });

  it("normalizeSourceId strips path and extension", async () => {
    const { normalizeSourceId } = await import("../ir/resolve-media-ir.js");
    expect(normalizeSourceId("/abs/path/hello.media.ts")).toBe("hello");
    expect(normalizeSourceId("hello.media.js")).toBe("hello");
    expect(normalizeSourceId("hello")).toBe("hello");
  });
});
