import { describe, it, expect } from "vitest";
import { compileTemplate, validateTemplate } from "../rendering/compiler.js";
import { bundleTemplateCode } from "../bundler/bundler.js";
import {
  makeTestContext,
  makeTestContextAtProgress,
  makeTestContextAtSeconds,
  compileFromString,
  asMarkup,
} from "./__test-utils__/index.js";

function wrapDefineTemplate(code: string) {
  return `import { define, Html } from '@foxworth/superimg';\n${code}`;
}

describe("compileTemplate (with bundled code)", () => {
  it("preserves authored poster selection across compilation", async () => {
    const result = await compileFromString(`
      import { video, Html } from '@foxworth/superimg';
      export default video({
        duration: '4.5s', poster: '3.4s',
        render: () => Html({ html: 'Logo' }),
      });
    `);
    expect(result.error).toBeUndefined();
    expect(result.media?.poster).toBe("3.4s");
  });

  it("compiles a simple template with render function", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) { return Html({ width: 'fill', height: 'fill', html: '<div>Hello</div>' }); }
      });
    `));
    expect(result.error).toBeUndefined();
    expect(result.media).toBeDefined();
    expect(result.media?.render).toBeInstanceOf(Function);
  });

  it("compiles template with config export", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        config: { fps: 30 },
        render(ctx) { return Html({ width: 'fill', height: 'fill', html: '<div>Test</div>' }); }
      });
    `));
    expect(result.error).toBeUndefined();
    expect(result.media?.config).toEqual({ fps: 30 });
  });

  it("compiles template with sample export", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        sample: { title: 'Hello', count: 42 },
        render(ctx) { return Html({ width: 'fill', height: 'fill', html: '<div>' + ctx.data.title + '</div>' }); }
      });
    `));
    expect(result.error).toBeUndefined();
    expect(result.media?.sample).toEqual({ title: "Hello", count: 42 });
  });

  it("provides stdlib access via ctx.std", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) {
          const eased = ctx.std.interpolate(ctx.timeline.progress, [0, 1], [0, 1], 'easeInOutCubic');
          return Html({ width: 'fill', height: 'fill', html: \`<div style="opacity: \${eased}">\${eased}</div>\` });
        }
      });
    `));
    expect(result.error).toBeUndefined();

    const testCtx = makeTestContextAtProgress(0.5);

    const html = asMarkup(result.media!.render(testCtx));
    expect(html).toContain("0.5");
  });

  it("provides ctx.track() transcript sync", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) {
          const vo = ctx.track({ words: [{ text: 'hello', start: 0, end: 1 }] });
          const t = vo.transcript();
          return Html({ width: 'fill', height: 'fill', html: '<div>' + (t.current()?.text ?? 'none') + ':' + t.count() + '</div>' });
        }
      });
    `));
    expect(result.error).toBeUndefined();

    const html = asMarkup(result.media!.render(makeTestContextAtSeconds(0.5)));
    expect(html).toBe("<div>hello:1</div>");
  });

  it("bundles direct imports from @superimg/stdlib/cue", async () => {
    const result = await compileFromString(`
      import { define, Html } from '@foxworth/superimg';
      import { transcript } from '@superimg/stdlib/cue';

      export default define({
        render(ctx) {
          const t = transcript([
            { text: 'hello', start: 0, end: 1 }
          ], ctx.timeline.seconds);
          return Html({ width: 'fill', height: 'fill', html: '<div>' + (t.current()?.text ?? 'none') + '</div>' });
        }
      });
    `);
    expect(result.error).toBeUndefined();

    const html = asMarkup(result.media!.render(makeTestContextAtSeconds(0.5)));
    expect(html).toBe("<div>hello</div>");
  });

  it("bundles public direct imports from @foxworth/superimg/transcript", async () => {
    const result = await compileFromString(`
      import { define, Html } from '@foxworth/superimg';
      import { transcript } from '@foxworth/superimg/transcript';

      export default define({
        render(ctx) {
          const t = transcript([
            { text: 'hello', start: 0, end: 1 }
          ], ctx.timeline.seconds);
          return Html({ width: 'fill', height: 'fill', html: '<div>' + (t.current()?.text ?? 'none') + '</div>' });
        }
      });
    `);
    expect(result.error).toBeUndefined();

    const html = asMarkup(result.media!.render(makeTestContextAtSeconds(0.5)));
    expect(html).toBe("<div>hello</div>");
  });

  it("bundles public direct imports from @foxworth/superimg/stdlib/text", async () => {
    const result = await compileFromString(`
      import { define, Html } from '@foxworth/superimg';
      import { formatCompact } from '@foxworth/superimg/stdlib/text';

      export default define({
        render() {
          return Html({ width: 'fill', height: 'fill', html: '<div>' + formatCompact(1200) + '</div>' });
        }
      });
    `);
    expect(result.error).toBeUndefined();

    const html = asMarkup(result.media!.render(makeTestContext()));
    expect(html).toBe("<div>1.2K</div>");
  });

  it("provides ctx.std.interpolate for eased interpolation", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) {
          const x = ctx.std.interpolate(ctx.timeline.progress, [0, 1], [0, 100], 'easeOutCubic');
          return Html({ width: 'fill', height: 'fill', html: \`<div style="left: \${x}px">\${x}</div>\` });
        }
      });
    `));
    expect(result.error).toBeUndefined();
    const html = asMarkup(result.media!.render(makeTestContextAtProgress(0.5)));
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
        render(ctx) { return Html({ width: 'fill', height: 'fill', html: '<div>Test</div>' }); }
      });
    `));
    expect(result.error).toBeUndefined();
    expect(result.media?.render).toBeInstanceOf(Function);
    expect(result.media?.render.name).toBe("render");
  });

  it("compiles export const correctly", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        config: { width: 1920 },
        render(ctx) { return Html({ width: 'fill', height: 'fill', html: '<div></div>' }); }
      });
    `));
    expect(result.error).toBeUndefined();
    expect(result.media?.config).toEqual({ width: 1920 });
  });

  it("compiles export let correctly", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      let config = { height: 1080 };
      export default define({ config, render(ctx) { return Html({ width: 'fill', height: 'fill', html: '<div></div>' }); } });
    `));
    expect(result.error).toBeUndefined();
    expect(result.media?.config).toEqual({ height: 1080 });
  });

  it("returns error when render function is missing", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({ config: { fps: 30 } });
    `));
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain("deterministic media");
    expect(result.media).toBeUndefined();
  });

  it("returns error for bundling syntax errors", async () => {
    const code = `
      import { define } from '@foxworth/superimg';
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
    expect(result.media).toBeDefined();
  });

  it("handles complex template with ctx.std usage", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        config: { fps: 30, width: 1920 },
        render(ctx) {
          const color = ctx.std.color.parseColor('#ff0000');
          return Html({ width: 'fill', height: 'fill', html: \`<div style="color: \${color.hex}">Hello</div>\` });
        }
      });
    `));
    expect(result.error).toBeUndefined();
    expect(result.media?.render).toBeInstanceOf(Function);
    expect(result.media?.config).toEqual({ fps: 30, width: 1920 });
  });

  it("does not mangle export keyword inside string literals", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) { return Html({ width: 'fill', height: 'fill', html: '<div>export default is a keyword</div>' }); }
      });
    `));
    expect(result.error).toBeUndefined();
    const html = asMarkup(result.media!.render(makeTestContext()));
    expect(html).toBe("<div>export default is a keyword</div>");
  });

  it("compiles export async function", async () => {
    const result = await compileFromString(wrapDefineTemplate(`
      export default define({
        async render(ctx) { return Html({ width: 'fill', height: 'fill', html: '<div>async</div>' }); }
      });
    `));
    expect(result.error).toBeUndefined();
    expect(result.media?.render).toBeInstanceOf(Function);
  });

  it("rejects a bare default object", async () => {
    const code = `
      export default {
        sample: { title: 'Object default' },
        render(ctx) {
          return '<div>' + ctx.data.title + '</div>';
        }
      }
    `;

    const result = await compileFromString(code);
    expect(result.error?.message).toContain("deterministic media");
    expect(result.media).toBeUndefined();
  });

  it("compiles export default define({ render, config, sample })", async () => {
    const code = `
      import { define, Html } from '@foxworth/superimg';
      function render(ctx) {
        return Html({ width: 'fill', height: 'fill', html: '<div>' + ctx.data.title + '</div>' });
      }
      const config = { fps: 24 };
      const sample = { title: 'Define default' };
      export default define({ render, config, sample });
    `;

    const result = await compileFromString(code);
    expect(result.error).toBeUndefined();
    expect(result.media?.render).toBeInstanceOf(Function);
    expect(result.media?.config).toEqual({ fps: 24 });
    expect(result.media?.sample).toEqual({ title: "Define default" });

    const html = asMarkup(result.media!.render(
      makeTestContext({ data: { title: "Define default" } })
    ));
    expect(html).toBe("<div>Define default</div>");
  });

  it("returns error when default export has no render", async () => {
    const result = await compileFromString(`
      export default { config: { fps: 30 } };
    `);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain("deterministic media");
  });
});

describe("validateTemplate", () => {
  it("validates a working template", async () => {
    const code = wrapDefineTemplate(`
      export default define({
        render(ctx) { return Html({ width: 'fill', height: 'fill', html: '<div>Valid</div>' }); }
      });
    `);

    const compileResult = await compileFromString(code);
    expect(compileResult.media).toBeDefined();

    const testCtx = makeTestContext();

    const error = validateTemplate(compileResult.media!, testCtx);
    expect(error).toBeNull();
  });

  it("returns error when render returns a non-tree value", async () => {
    const compileResult = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) { return 123; }
      });
    `));
    expect(compileResult.media).toBeDefined();

    const testCtx = makeTestContext();

    const error = validateTemplate(compileResult.media!, testCtx);
    expect(error).toBeDefined();
    expect(error?.message).toContain("must return a MediaElement tree");
  });

  it("returns error for runtime exceptions", async () => {
    const compileResult = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) { throw new Error('Runtime error'); }
      });
    `));
    expect(compileResult.media).toBeDefined();

    const testCtx = makeTestContext();

    const error = validateTemplate(compileResult.media!, testCtx);
    expect(error).toBeDefined();
    expect(error?.message).toContain("Runtime error");
  });

  it("validates template with ctx.std usage", async () => {
    const compileResult = await compileFromString(wrapDefineTemplate(`
      export default define({
        render(ctx) {
          const eased = ctx.std.interpolate(ctx.timeline.progress, [0, 1], [0, 1], 'easeInOutCubic');
          return Html({ width: 'fill', height: 'fill', html: \`<div style="opacity: \${eased}">\${eased}</div>\` });
        }
      });
    `));
    expect(compileResult.media).toBeDefined();

    const testCtx = makeTestContextAtProgress(0.5);

    const error = validateTemplate(compileResult.media!, testCtx);
    expect(error).toBeNull();
  });
});
