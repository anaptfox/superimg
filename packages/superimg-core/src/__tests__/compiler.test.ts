import { describe, it, expect } from "vitest";
import { compileTemplate, validateTemplate } from "../rendering/compiler.js";
import { bundleTemplateCode } from "../bundler/bundler.js";
import {
  makeTestContext,
  makeTestContextAtProgress,
  makeTestContextAtSeconds,
  compileFromString,
} from "./__test-utils__/index.js";

function wrapDefineTemplate(code: string) {
  return `import { define } from 'superimg';\n${code}`;
}

describe("compileTemplate (with bundled code)", () => {
  it("compiles a simple template with render function", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) { return '<div>Hello</div>'; }
      });
    `));
    expect(result.error).toBeUndefined();
    expect(result.template).toBeDefined();
    expect(result.template?.render).toBeInstanceOf(Function);
  });

  it("compiles template with config export", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        config: { fps: 30 },
        render(ctx) { return '<div>Test</div>'; }
      });
    `));
    expect(result.error).toBeUndefined();
    expect(result.template?.config).toEqual({ fps: 30 });
  });

  it("compiles template with sample export", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        sample: { title: 'Hello', count: 42 },
        render(ctx) { return '<div>' + ctx.data.title + '</div>'; }
      });
    `));
    expect(result.error).toBeUndefined();
    expect(result.template?.sample).toEqual({ title: "Hello", count: 42 });
  });

  it("provides stdlib access via ctx.std", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) {
          const eased = ctx.std.interpolate(ctx.timeline.progress, [0, 1], [0, 1], 'easeInOutCubic');
          return \`<div style="opacity: \${eased}">\${eased}</div>\`;
        }
      });
    `));
    expect(result.error).toBeUndefined();

    const testCtx = makeTestContextAtProgress(0.5);

    const html = result.template!.render(testCtx);
    expect(html).toContain("0.5");
  });

  it("provides ctx.track() transcript sync", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) {
          const vo = ctx.track({ words: [{ text: 'hello', start: 0, end: 1 }] });
          const t = vo.transcript();
          return '<div>' + (t.current()?.text ?? 'none') + ':' + t.count() + '</div>';
        }
      });
    `));
    expect(result.error).toBeUndefined();

    const html = result.template!.render(makeTestContextAtSeconds(0.5));
    expect(html).toBe("<div>hello:1</div>");
  });

  it("bundles direct imports from @superimg/stdlib/cue", async () => {
    const result = await compileFromString(`
      import { define } from 'superimg';
      import { transcript } from '@superimg/stdlib/cue';

      export default define({
        render(ctx) {
          const t = transcript([
            { text: 'hello', start: 0, end: 1 }
          ], ctx.timeline.seconds);
          return '<div>' + (t.current()?.text ?? 'none') + '</div>';
        }
      });
    `);
    expect(result.error).toBeUndefined();

    const html = result.template!.render(makeTestContextAtSeconds(0.5));
    expect(html).toBe("<div>hello</div>");
  });

  it("bundles public direct imports from superimg/stdlib/cue", async () => {
    const result = await compileFromString(`
      import { define } from 'superimg';
      import { transcript } from 'superimg/stdlib/cue';

      export default define({
        render(ctx) {
          const t = transcript([
            { text: 'hello', start: 0, end: 1 }
          ], ctx.timeline.seconds);
          return '<div>' + (t.current()?.text ?? 'none') + '</div>';
        }
      });
    `);
    expect(result.error).toBeUndefined();

    const html = result.template!.render(makeTestContextAtSeconds(0.5));
    expect(html).toBe("<div>hello</div>");
  });

  it("bundles public direct imports from superimg/stdlib/text", async () => {
    const result = await compileFromString(`
      import { define } from 'superimg';
      import { formatCompact } from 'superimg/stdlib/text';

      export default define({
        render() {
          return '<div>' + formatCompact(1200) + '</div>';
        }
      });
    `);
    expect(result.error).toBeUndefined();

    const html = result.template!.render(makeTestContext());
    expect(html).toBe("<div>1.2K</div>");
  });

  it("provides ctx.std.interpolate for eased interpolation", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) {
          const x = ctx.std.interpolate(ctx.timeline.progress, [0, 1], [0, 100], 'easeOutCubic');
          return \`<div style="left: \${x}px">\${x}</div>\`;
        }
      });
    `));
    expect(result.error).toBeUndefined();
    const html = result.template!.render(makeTestContextAtProgress(0.5));
    expect(html).toContain("left:");
    const match = html.match(/left: (\d+(?:\.\d+)?)px/);
    expect(match).toBeTruthy();
    const x = parseFloat(match![1]!);
    expect(x).toBeGreaterThan(50);
    expect(x).toBeLessThanOrEqual(100);
  });

  it("preserves function declarations (hoisting and .name)", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) { return '<div>Test</div>'; }
      });
    `));
    expect(result.error).toBeUndefined();
    expect(result.template?.render).toBeInstanceOf(Function);
    expect(result.template?.render.name).toBe("render");
  });

  it("compiles export const correctly", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        config: { width: 1920 },
        render(ctx) { return '<div></div>'; }
      });
    `));
    expect(result.error).toBeUndefined();
    expect(result.template?.config).toEqual({ width: 1920 });
  });

  it("compiles export let correctly", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      let config = { height: 1080 };
      export default define({ config, render(ctx) { return '<div></div>'; } });
    `));
    expect(result.error).toBeUndefined();
    expect(result.template?.config).toEqual({ height: 1080 });
  });

  it("returns error when render function is missing", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({ config: { fps: 30 } });
    `));
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain("define");
    expect(result.template).toBeUndefined();
  });

  it("returns error for bundling syntax errors", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        render(ctx) {
          return '<div>Unclosed
        }
      });
    `;

    await expect(bundleTemplateCode(code)).rejects.toThrow();
  });

  it("returns error for runtime errors", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) { throw new Error('Test error'); }
      });
    `));
    expect(result.error).toBeUndefined();
    expect(result.template).toBeDefined();
  });

  it("handles complex template with ctx.std usage", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        config: { fps: 30, width: 1920 },
        render(ctx) {
          const color = ctx.std.color.parseColor('#ff0000');
          return \`<div style="color: \${color.hex}">Hello</div>\`;
        }
      });
    `));
    expect(result.error).toBeUndefined();
    expect(result.template?.render).toBeInstanceOf(Function);
    expect(result.template?.config).toEqual({ fps: 30, width: 1920 });
  });

  it("does not mangle export keyword inside string literals", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) { return '<div>export default is a keyword</div>'; }
      });
    `));
    expect(result.error).toBeUndefined();
    const html = result.template!.render(makeTestContext());
    expect(html).toBe("<div>export default is a keyword</div>");
  });

  it("compiles export async function", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        async render(ctx) { return '<div>async</div>'; }
      });
    `));
    expect(result.error).toBeUndefined();
    expect(result.template?.render).toBeInstanceOf(Function);
  });

  it("compiles export default object with render method", async () => {
    const code = `
      export default {
        sample: { title: 'Object default' },
        render(ctx) {
          return '<div>' + ctx.data.title + '</div>';
        }
      }
    `;

    const result = await compileFromString(code);
    expect(result.error).toBeUndefined();
    expect(result.template?.render).toBeInstanceOf(Function);
    expect(result.template?.sample).toEqual({ title: "Object default" });

    const html = result.template!.render(
      makeTestContext({ data: { title: "Object default" } })
    );
    expect(html).toBe("<div>Object default</div>");
  });

  it("compiles export default define({ render, config, sample })", async () => {
    const code = `
      import { define } from 'superimg';
      function render(ctx) {
        return '<div>' + ctx.data.title + '</div>';
      }
      const config = { fps: 24 };
      const sample = { title: 'Define default' };
      export default define({ render, config, sample });
    `;

    const result = await compileFromString(code);
    expect(result.error).toBeUndefined();
    expect(result.template?.render).toBeInstanceOf(Function);
    expect(result.template?.config).toEqual({ fps: 24 });
    expect(result.template?.sample).toEqual({ title: "Define default" });

    const html = result.template!.render(
      makeTestContext({ data: { title: "Define default" } })
    );
    expect(html).toBe("<div>Define default</div>");
  });

  it("returns error when default export has no render", async () => {
    const result = await compileFromString(`
      export default { config: { fps: 30 } };
    `);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain("define");
  });
});

describe("validateTemplate", () => {
  it("validates a working template", async () => {
    const code = wrapDefineTemplate(`
      export default define({
        render(ctx) { return '<div>Valid</div>'; }
      });
    `);

    const compileResult = await compileFromString(code);
    expect(compileResult.template).toBeDefined();

    const testCtx = makeTestContext();

    const error = validateTemplate(compileResult.template!, testCtx);
    expect(error).toBeNull();
  });

  it("returns error when render returns non-string", async () => {
    const compileResult = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) { return 123; }
      });
    `));
    expect(compileResult.template).toBeDefined();

    const testCtx = makeTestContext();

    const error = validateTemplate(compileResult.template!, testCtx);
    expect(error).toBeDefined();
    expect(error?.message).toContain("must return a string");
  });

  it("returns error for runtime exceptions", async () => {
    const compileResult = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) { throw new Error('Runtime error'); }
      });
    `));
    expect(compileResult.template).toBeDefined();

    const testCtx = makeTestContext();

    const error = validateTemplate(compileResult.template!, testCtx);
    expect(error).toBeDefined();
    expect(error?.message).toContain("Runtime error");
  });

  it("validates template with ctx.std usage", async () => {
    const compileResult = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) {
          const eased = ctx.std.interpolate(ctx.timeline.progress, [0, 1], [0, 1], 'easeInOutCubic');
          return \`<div style="opacity: \${eased}">\${eased}</div>\`;
        }
      });
    `));
    expect(compileResult.template).toBeDefined();

    const testCtx = makeTestContextAtProgress(0.5);

    const error = validateTemplate(compileResult.template!, testCtx);
    expect(error).toBeNull();
  });
});
