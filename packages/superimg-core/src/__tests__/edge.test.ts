import { describe, it, expect } from "vitest";
import type { ImageModule } from "@superimg/types";
import { renderNativeToHtml, renderToHtml } from "../edge.js";
import { bundleTemplateCode } from "../bundler/bundler.js";

describe("renderNativeToHtml", () => {
  it("renders a TemplateModule object to HTML without Playwright", () => {
    const template: ImageModule = {
      kind: "image",
      config: { width: 800, height: 600 },
      render: (ctx) => `<div data-w="${ctx.width}">hello ${ctx.data?.name ?? ""}</div>`,
    };

    const html = renderNativeToHtml({ template, data: { name: "world" } });

    expect(html).toContain("hello world");
    expect(html).toContain('data-w="800"');
  });

  it("compiles and renders an IIFE-bundled template string", async () => {
    const code = `
      import { defineImage } from "superimg";
      export default defineImage({
        config: { width: 400, height: 400 },
        render: (ctx) => \`<h1>\${ctx.data.title}</h1>\`,
      });
    `;
    const bundled = await bundleTemplateCode(code);

    const html = renderNativeToHtml({
      template: bundled,
      data: { title: "Edge Render" },
    });

    expect(html).toContain("Edge Render");
    // The string path must actually produce content, not undefined.
    expect(html).not.toContain("undefined");
  });
});

describe("renderToHtml — sample field fallback", () => {
  it("uses module.sample when options.data is not provided", () => {
    const template: ImageModule & { sample?: Record<string, unknown> } = {
      kind: "image",
      config: { width: 600, height: 400 },
      sample: { greeting: "from sample" },
      render: (ctx) => `<span>${(ctx.data as any).greeting ?? ""}</span>`,
    };

    const html = renderToHtml({ template });

    expect(html).toContain("from sample");
  });

  it("options.data overrides module.sample", () => {
    const template: ImageModule & { sample?: Record<string, unknown> } = {
      kind: "image",
      config: { width: 600, height: 400 },
      sample: { greeting: "sample value" },
      render: (ctx) => `<span>${(ctx.data as any).greeting ?? ""}</span>`,
    };

    const html = renderToHtml({ template, data: { greeting: "runtime override" } });

    expect(html).toContain("runtime override");
    expect(html).not.toContain("sample value");
  });

  it("falls back to empty object when neither sample nor data is provided", () => {
    const template: ImageModule = {
      kind: "image",
      config: { width: 400, height: 400 },
      render: (ctx) => `<div data-empty="${JSON.stringify(ctx.data)}"></div>`,
    };

    const html = renderToHtml({ template });

    expect(html).toContain("{}");
  });

  it("renderToHtml and renderNativeToHtml are aliases — both accept sample-bearing modules", () => {
    const template: ImageModule & { sample?: Record<string, unknown> } = {
      kind: "image",
      config: { width: 300, height: 200 },
      sample: { tag: "alias-check" },
      render: (ctx) => `<p>${(ctx.data as any).tag ?? ""}</p>`,
    };

    const html1 = renderToHtml({ template });
    const html2 = renderNativeToHtml({ template });

    expect(html1).toBe(html2);
    expect(html1).toContain("alias-check");
  });

  it("respects explicit width/height options over module.config", () => {
    const template: ImageModule = {
      kind: "image",
      config: { width: 100, height: 100 },
      render: (ctx) => `<div data-w="${ctx.width}" data-h="${ctx.height}"></div>`,
    };

    const html = renderToHtml({ template, width: 1200, height: 630 });

    expect(html).toContain('data-w="1200"');
    expect(html).toContain('data-h="630"');
  });

  it("renders a specific frame via frame option", () => {
    const template: ImageModule & { sample?: Record<string, unknown> } = {
      kind: "video",
      config: { fps: 30, duration: 2, width: 640, height: 360 },
      render: (ctx) => `<div data-progress="${ctx.sceneProgress}"></div>`,
    };

    const start = renderToHtml({ template, frame: 0, composite: false });
    const mid = renderToHtml({ template, frame: 30, composite: false });

    expect(start).toContain('data-progress="0"');
    expect(mid).toMatch(/data-progress="0\.5/);
  });

  it("renders a bundled template string using sample as default data", async () => {
    const code = `
      import { defineImage } from "superimg";
      export default defineImage({
        sample: { headline: "bundled sample" },
        config: { width: 800, height: 400 },
        render: (ctx) => \`<h2>\${ctx.data.headline}</h2>\`,
      });
    `;
    const bundled = await bundleTemplateCode(code);

    // No data provided — renderToHtml should use sample from the bundled module
    const html = renderToHtml({ template: bundled });

    expect(html).toContain("bundled sample");
  });
});
