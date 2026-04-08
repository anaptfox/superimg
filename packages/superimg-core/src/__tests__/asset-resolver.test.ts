import { describe, it, expect } from "vitest";
import { createRenderContext } from "../rendering/wasm.js";

describe("ctx.asset()", () => {
  it("returns filename as-is with no resolver", () => {
    const ctx = createRenderContext(0, 30, 60, 1920, 1080);
    expect(ctx.asset("logo.png")).toBe("logo.png");
  });

  it("returns resolved URL when resolver is provided", () => {
    const resolver = (filename: string) =>
      `http://localhost:3000/assets?path=/tmp/assets/${filename}`;
    const ctx = createRenderContext(0, 30, 60, 1920, 1080, {}, "default", {}, resolver);
    expect(ctx.asset("logo.png")).toBe("http://localhost:3000/assets?path=/tmp/assets/logo.png");
  });

  it("is independent from ctx.assets", () => {
    const ctx = createRenderContext(0, 30, 60, 1920, 1080, {}, "default", {
      brandMark: { type: "image" as const, url: "http://example.com/brand.png", mimeType: "image/png", size: 1024, width: 100, height: 100 },
    });
    expect(ctx.asset("brand.png")).toBe("brand.png");
    expect(ctx.assets.brandMark.url).toBe("http://example.com/brand.png");
  });
});
