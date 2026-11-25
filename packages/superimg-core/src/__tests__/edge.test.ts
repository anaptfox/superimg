import { describe, it, expect } from "vitest";
import { image, video, type JsonObject } from "@superimg/types";
import { renderToHtml } from "../edge.js";
import { bundleTemplateCode } from "../bundler/bundler.js";
import { boxedHtml } from "./__test-utils__/index.js";

describe("renderToHtml", () => {
  it("renders a media definition to HTML without Playwright", () => {
    const template = image<JsonObject>({
      size: { width: 800, height: 600 },
      render: (ctx) => boxedHtml(`<div data-w="${ctx.width}">hello ${ctx.data?.name ?? ""}</div>`),
    });

    const html = renderToHtml({ template, data: { name: "world" } });

    expect(html).toContain("hello world");
    expect(html).toContain('data-w="800"');
  });

  it("compiles and renders an IIFE-bundled template string", async () => {
    const code = `
      import { define, Html } from "@foxworth/superimg";
      export default define({
        config: { width: 400, height: 400 },
        render: (ctx) => Html({ width: "fill", height: "fill", html: \`<h1>\${ctx.data.title}</h1>\` }),
      });
    `;
    const bundled = await bundleTemplateCode(code);

    const html = renderToHtml({
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
    const template = image<JsonObject>({
      size: { width: 600, height: 400 },
      sample: { greeting: "from sample" },
      render: (ctx) => boxedHtml(`<span>${ctx.data.greeting}</span>`),
    });

    const html = renderToHtml({ template });

    expect(html).toContain("from sample");
  });

  it("options.data overrides module.sample", () => {
    const template = image<JsonObject>({
      size: { width: 600, height: 400 },
      sample: { greeting: "sample value" },
      render: (ctx) => boxedHtml(`<span>${ctx.data.greeting}</span>`),
    });

    const html = renderToHtml({ template, data: { greeting: "runtime override" } });

    expect(html).toContain("runtime override");
    expect(html).not.toContain("sample value");
  });

  it("falls back to empty object when neither sample nor data is provided", () => {
    const template = image<JsonObject>({
      size: { width: 400, height: 400 },
      render: (ctx) => boxedHtml(`<div data-empty="${JSON.stringify(ctx.data)}"></div>`),
    });

    const html = renderToHtml({ template });

    expect(html).toContain("{}");
  });

  it("accepts sample-bearing modules", () => {
    const template = image<JsonObject>({
      size: { width: 300, height: 200 },
      sample: { tag: "alias-check" },
      render: (ctx) => boxedHtml(`<p>${ctx.data.tag}</p>`),
    });

    const html = renderToHtml({ template });

    expect(html).toContain("alias-check");
  });

  it("respects explicit width/height options over module.config", () => {
    const template = image<JsonObject>({
      size: { width: 100, height: 100 },
      render: (ctx) => boxedHtml(`<div data-w="${ctx.width}" data-h="${ctx.height}"></div>`),
    });

    const html = renderToHtml({ template, width: 1200, height: 630 });

    expect(html).toContain('data-w="1200"');
    expect(html).toContain('data-h="630"');
  });

  it("renders a specific frame via frame option", () => {
    const template = video<JsonObject>({
      fps: 30,
      duration: 2,
      size: { width: 640, height: 360 },
      render: (ctx) => boxedHtml(`<div data-progress="${ctx.timeline.progress}"></div>`),
    });

    const start = renderToHtml({ template, frame: 0, composite: false });
    const mid = renderToHtml({ template, frame: 30, composite: false });

    expect(start).toContain('data-progress="0"');
    expect(mid).toMatch(/data-progress="0\.5/);
  });

  it("renders a bundled template string using sample as default data", async () => {
    const code = `
      import { define, Html } from "@foxworth/superimg";
      export default define({
        sample: { headline: "bundled sample" },
        config: { width: 800, height: 400 },
        render: (ctx) => Html({ width: "fill", height: "fill", html: \`<h2>\${ctx.data.headline}</h2>\` }),
      });
    `;
    const bundled = await bundleTemplateCode(code);

    // No data provided — renderToHtml should use sample from the bundled module
    const html = renderToHtml({ template: bundled });

    expect(html).toContain("bundled sample");
  });
});
