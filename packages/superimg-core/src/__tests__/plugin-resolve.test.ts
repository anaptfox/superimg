import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import {
  createSuperimgPlugin,
  resolveTemplateRuntimePath,
} from "../bundler/plugin.js";
import { bundleTemplateCode } from "../bundler/bundler.js";
import { compileTemplate } from "../rendering/compiler.js";

describe("server bundler plugin — real module resolve", () => {
  it("resolves the bare authoring runtime to an existing file", () => {
    const runtime = resolveTemplateRuntimePath();
    expect(existsSync(runtime)).toBe(true);
    expect(runtime).toMatch(/template-public\.[jt]s$/);
    expect(runtime).not.toMatch(/generated|RUNTIME_CODE|DEFINE_CODE/);
  });

  it("plugin resolves bare superimg and rejects the removed define subpath", () => {
    const plugin = createSuperimgPlugin();
    const superimgId = plugin.resolveId("@foxworth/superimg");
    const defineId = plugin.resolveId("@foxworth/superimg/define");
    expect(superimgId).toBeTruthy();
    expect(defineId).toBeNull();
    expect(existsSync(superimgId!)).toBe(true);
    // No string load for real modules — rolldown reads the file
    expect(plugin.load(superimgId!)).toBeNull();
  });

  it("bundles the official easing subpath into executable authoring code", async () => {
    const bundled = await bundleTemplateCode(`
      import { define, Html } from "@foxworth/superimg";
      import { easeOutCubic } from "@foxworth/superimg/stdlib/easing";
      export default define({
        sample: { eased: easeOutCubic(0.5) },
        render() { return Html({ width: 100, height: 100, html: "<div/>" }); }
      });`, { sourcefile: "official-easing.media.ts" });
    const { media, error } = compileTemplate(bundled);
    expect(error).toBeUndefined();
    expect(media?.sample).toEqual({ eased: 0.875 });
  });

  it("bundles a template importing define from superimg", async () => {
    const code = `
      import { define, Html } from "@foxworth/superimg";
      export default define({
        sample: { msg: "ok" },
        config: { width: 100, height: 100 },
        render(ctx) { return Html({ width: "fill", height: "fill", html: "<div>" + ctx.data.msg + "</div>" }); }
      });
    `;
    const bundled = await bundleTemplateCode(code, { sourcefile: "plugin-resolve.media.ts" });
    expect(bundled).toContain("ok");
    const { media, error } = compileTemplate(bundled);
    expect(error).toBeUndefined();
    expect(media?.render).toBeInstanceOf(Function);
  });

  it("define comes from typed implementation (animated flag)", async () => {
    const code = `
      import { define, Html } from "@foxworth/superimg";
      export default define({
        config: { fps: 30, duration: 2 },
        render() { return Html({ width: "fill", height: "fill", html: "<div/>" }); }
      });
    `;
    const bundled = await bundleTemplateCode(code, { sourcefile: "animated.media.ts" });
    const { media, error } = compileTemplate(bundled);
    expect(error).toBeUndefined();
    expect(media?.animated).toBe(true);
  });
});
