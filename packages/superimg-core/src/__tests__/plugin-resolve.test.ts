import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import {
  createSuperimgPlugin,
  resolveDefinePath,
  resolveTemplateRuntimePath,
} from "../bundler/plugin.js";
import { bundleTemplateCode } from "../bundler/bundler.js";
import { compileTemplate } from "../rendering/compiler.js";

describe("server bundler plugin — real module resolve", () => {
  it("resolves template-runtime and define to existing files", () => {
    const runtime = resolveTemplateRuntimePath();
    const define = resolveDefinePath();
    expect(existsSync(runtime)).toBe(true);
    expect(existsSync(define)).toBe(true);
    expect(runtime).not.toMatch(/generated|RUNTIME_CODE|DEFINE_CODE/);
    expect(define).not.toMatch(/DEFINE_CODE|define-code/);
  });

  it("plugin resolveId returns real paths for superimg and define", () => {
    const plugin = createSuperimgPlugin();
    const superimgId = plugin.resolveId("superimg");
    const defineId = plugin.resolveId("superimg/define");
    expect(superimgId).toBeTruthy();
    expect(defineId).toBeTruthy();
    expect(existsSync(superimgId!)).toBe(true);
    expect(existsSync(defineId!)).toBe(true);
    // No string load for real modules — rolldown reads the file
    expect(plugin.load(superimgId!)).toBeNull();
    expect(plugin.load(defineId!)).toBeNull();
  });

  it("bundles a template importing define from superimg", async () => {
    const code = `
      import { define } from "superimg";
      export default define({
        sample: { msg: "ok" },
        config: { width: 100, height: 100 },
        render(ctx) { return "<div>" + ctx.data.msg + "</div>"; }
      });
    `;
    const bundled = await bundleTemplateCode(code, { sourcefile: "plugin-resolve.media.ts" });
    expect(bundled).toContain("ok");
    const { template, error } = compileTemplate(bundled);
    expect(error).toBeUndefined();
    expect(template?.render).toBeInstanceOf(Function);
  });

  it("define comes from typed implementation (animated flag)", async () => {
    const code = `
      import { define } from "superimg";
      export default define({
        config: { fps: 30, duration: 2 },
        render() { return "<div/>"; }
      });
    `;
    const bundled = await bundleTemplateCode(code, { sourcefile: "animated.media.ts" });
    const { template, error } = compileTemplate(bundled);
    expect(error).toBeUndefined();
    expect(template?.animated).toBe(true);
  });
});
