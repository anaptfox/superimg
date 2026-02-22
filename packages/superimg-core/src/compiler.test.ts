import { describe, it, expect } from "vitest";
import { compileTemplate, validateTemplate } from "./compiler.js";
import { bundleTemplateCode } from "./bundler.js";
import type { RenderContext } from "@superimg/types";
import { createRenderContext } from "./wasm.js";

function makeTestContext(overrides?: Partial<RenderContext>): RenderContext {
  const base = createRenderContext(0, 30, 60, 1920, 1080);
  return { ...base, ...overrides };
}

/** Bundle template code from string, then compile. Used for tests. */
async function bundleAndCompile(code: string) {
  const bundled = await bundleTemplateCode(code);
  return compileTemplate(bundled);
}

describe("compileTemplate (with bundled code)", () => {
  it("compiles a simple template with render function", async () => {
    const code = `
      export function render(ctx) {
        return '<div>Hello</div>';
      }
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeUndefined();
    expect(result.template).toBeDefined();
    expect(result.template?.render).toBeInstanceOf(Function);
  });

  it("compiles template with config export", async () => {
    const code = `
      export const config = { fps: 30 };
      export function render(ctx) {
        return '<div>Test</div>';
      }
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeUndefined();
    expect(result.template?.config).toEqual({ fps: 30 });
  });

  it("compiles template with defaults export", async () => {
    const code = `
      export const defaults = { title: 'Hello', count: 42 };
      export function render(ctx) {
        return '<div>' + ctx.data.title + '</div>';
      }
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeUndefined();
    expect(result.template?.defaults).toEqual({ title: "Hello", count: 42 });
  });

  it("provides stdlib access via ctx.std", async () => {
    const code = `
      export function render(ctx) {
        const eased = ctx.std.easing.easeInOutCubic(ctx.sceneProgress);
        return \`<div style="opacity: \${eased}">\${eased}</div>\`;
      }
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeUndefined();

    const testCtx = makeTestContext({ globalProgress: 0.5, sceneProgress: 0.5 });

    const html = result.template!.render(testCtx);
    expect(html).toContain("0.5");
  });

  it("preserves function declarations (hoisting and .name)", async () => {
    const code = `
      export function render(ctx) {
        return '<div>Test</div>';
      }
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeUndefined();
    expect(result.template?.render).toBeInstanceOf(Function);
    expect(result.template?.render.name).toBe("render");
  });

  it("compiles export const correctly", async () => {
    const code = `
      export const config = { width: 1920 };
      export function render(ctx) {
        return '<div></div>';
      }
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeUndefined();
    expect(result.template?.config).toEqual({ width: 1920 });
  });

  it("compiles export let correctly", async () => {
    const code = `
      export let config = { height: 1080 };
      export function render(ctx) {
        return '<div></div>';
      }
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeUndefined();
    expect(result.template?.config).toEqual({ height: 1080 });
  });

  it("compiles default export named function", async () => {
    const code = `
      export default function render(ctx) {
        return '<div>Default</div>';
      }
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeUndefined();
    expect(result.template).toBeDefined();
    expect(result.template?.render).toBeInstanceOf(Function);

    const html = result.template!.render(makeTestContext());
    expect(html).toBe("<div>Default</div>");
  });

  it("returns error when render function is missing", async () => {
    const code = `
      export const config = { fps: 30 };
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain("export a 'render' function");
    expect(result.template).toBeUndefined();
  });

  it("returns error for bundling syntax errors", async () => {
    const code = `
      export function render(ctx) {
        return '<div>Unclosed
      }
    `;

    await expect(bundleTemplateCode(code)).rejects.toThrow();
  });

  it("returns error for runtime errors", async () => {
    const code = `
      export function render(ctx) {
        throw new Error('Test error');
      }
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeUndefined();
    expect(result.template).toBeDefined();
  });

  it("handles complex template with ctx.std usage", async () => {
    const code = `
      export const config = { fps: 30, width: 1920 };
      export function render(ctx) {
        const color = ctx.std.color.parseColor('#ff0000');
        return \`<div style="color: \${color.hex}">Hello</div>\`;
      }
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeUndefined();
    expect(result.template?.render).toBeInstanceOf(Function);
    expect(result.template?.config).toEqual({ fps: 30, width: 1920 });
  });

  it("does not mangle export keyword inside string literals", async () => {
    const code = `
      export function render(ctx) {
        return '<div>export default is a keyword</div>';
      }
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeUndefined();
    const html = result.template!.render(makeTestContext());
    expect(html).toBe("<div>export default is a keyword</div>");
  });

  it("compiles export async function", async () => {
    const code = `
      export async function render(ctx) {
        return '<div>async</div>';
      }
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeUndefined();
    expect(result.template?.render).toBeInstanceOf(Function);
  });

  it("handles named export without declaration (export { render })", async () => {
    const code = `
      function render(ctx) {
        return '<div>named</div>';
      }
      const config = { fps: 30 };
      export { render, config };
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeUndefined();
    expect(result.template?.render).toBeInstanceOf(Function);
    expect(result.template?.config).toEqual({ fps: 30 });
  });

  it("compiles export default object with render method", async () => {
    const code = `
      export default {
        defaults: { title: 'Object default' },
        render(ctx) {
          return '<div>' + ctx.data.title + '</div>';
        }
      }
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeUndefined();
    expect(result.template?.render).toBeInstanceOf(Function);
    expect(result.template?.defaults).toEqual({ title: "Object default" });

    const html = result.template!.render(
      makeTestContext({ data: { title: "Object default" } })
    );
    expect(html).toBe("<div>Object default</div>");
  });

  it("compiles export default defineTemplate({ render, config, defaults })", async () => {
    const code = `
      import { defineTemplate } from 'superimg';
      function render(ctx) {
        return '<div>' + ctx.data.title + '</div>';
      }
      const config = { fps: 24 };
      const defaults = { title: 'Define default' };
      export default defineTemplate({ render, config, defaults });
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeUndefined();
    expect(result.template?.render).toBeInstanceOf(Function);
    expect(result.template?.config).toEqual({ fps: 24 });
    expect(result.template?.defaults).toEqual({ title: "Define default" });

    const html = result.template!.render(
      makeTestContext({ data: { title: "Define default" } })
    );
    expect(html).toBe("<div>Define default</div>");
  });

  it("compiles export default anonymous function", async () => {
    const code = `
      export default function(ctx) {
        return '<div>anon</div>';
      }
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeUndefined();
    expect(result.template?.render).toBeInstanceOf(Function);

    const html = result.template!.render(makeTestContext());
    expect(html).toBe("<div>anon</div>");
  });

  it("returns error when default export has no render", async () => {
    const code = `
      export default {
        config: { fps: 30 }
      }
    `;

    const result = await bundleAndCompile(code);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain("render");
  });
});

describe("validateTemplate", () => {
  it("validates a working template", async () => {
    const code = `
      export function render(ctx) {
        return '<div>Valid</div>';
      }
    `;

    const compileResult = await bundleAndCompile(code);
    expect(compileResult.template).toBeDefined();

    const testCtx = makeTestContext();

    const error = validateTemplate(compileResult.template!, testCtx);
    expect(error).toBeNull();
  });

  it("returns error when render returns non-string", async () => {
    const code = `
      export function render(ctx) {
        return 123;
      }
    `;

    const compileResult = await bundleAndCompile(code);
    expect(compileResult.template).toBeDefined();

    const testCtx = makeTestContext();

    const error = validateTemplate(compileResult.template!, testCtx);
    expect(error).toBeDefined();
    expect(error?.message).toContain("must return a string");
  });

  it("returns error for runtime exceptions", async () => {
    const code = `
      export function render(ctx) {
        throw new Error('Runtime error');
      }
    `;

    const compileResult = await bundleAndCompile(code);
    expect(compileResult.template).toBeDefined();

    const testCtx = makeTestContext();

    const error = validateTemplate(compileResult.template!, testCtx);
    expect(error).toBeDefined();
    expect(error?.message).toContain("Runtime error");
  });

  it("validates template with ctx.std usage", async () => {
    const code = `
      export function render(ctx) {
        const eased = ctx.std.easing.easeInOutCubic(ctx.sceneProgress);
        return \`<div style="opacity: \${eased}">\${eased}</div>\`;
      }
    `;

    const compileResult = await bundleAndCompile(code);
    expect(compileResult.template).toBeDefined();

    const testCtx = makeTestContext({
      globalFrame: 30,
      sceneFrame: 30,
      globalProgress: 0.5,
      sceneProgress: 0.5,
    });

    const error = validateTemplate(compileResult.template!, testCtx);
    expect(error).toBeNull();
  });
});
