import { describe, it, expect } from "vitest";
import {
  validateAITemplate,
  formatValidationForAI,
  detectUndeclaredAssets,
} from "../validation/validation.js";

function wrapDefineTemplate(code: string) {
  return `import { defineScene } from 'superimg';\n${code}`;
}

describe("validateAITemplate", () => {
  it("passes for valid template", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) { return '<div>Hello</div>'; }
        });
      `)
    );
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("catches syntax errors", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) { return '<div>Unclosed
        });
      `)
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "SYNTAX_ERROR")).toBe(true);
  });

  it("catches missing render function", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          config: { fps: 30 }
        });
      `)
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "MISSING_RENDER_FUNCTION")).toBe(true);
  });

  it("catches frame-dependent errors", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) {
            if (ctx.sceneProgress > 0.5) throw new Error('Mid-video crash');
            return '<div>OK</div>';
          }
        });
      `)
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "RENDER_EXCEPTION")).toBe(true);
    // Should catch error at a frame > 0
    const errorIssue = result.issues.find((i) => i.code === "RENDER_EXCEPTION");
    expect(errorIssue?.frame).toBeGreaterThan(0);
  });

  it("catches NaN in output", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) {
            const x = 0 / 0;
            return \`<div style="left: \${x}px">Test</div>\`;
          }
        });
      `)
    );
    expect(result.issues.some((i) => i.code === "ANIMATION_PRODUCES_NAN")).toBe(true);
  });

  it("catches undefined in style attributes", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) {
            const value = ctx.data.nonexistent;
            return \`<div style="color: \${value}">Test</div>\`;
          }
        });
      `)
    );
    expect(result.issues.some((i) => i.code === "UNDEFINED_IN_OUTPUT")).toBe(true);
  });

  it("catches invalid easing names", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) {
            const x = ctx.std.tween(0, 100, ctx.sceneProgress, 'easeInOutBogus');
            return \`<div style="left: \${x}px">Test</div>\`;
          }
        });
      `)
    );
    expect(result.issues.some((i) => i.code === "INVALID_EASING_NAME")).toBe(true);
  });

  it("accepts valid easing names", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) {
            const x = ctx.std.tween(0, 100, ctx.sceneProgress, 'easeOutCubic');
            return \`<div style="left: \${x}px">Test</div>\`;
          }
        });
      `)
    );
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.code === "INVALID_EASING_NAME")).toHaveLength(0);
  });

  it("catches non-string return type", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) { return 123; }
        });
      `)
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "RENDER_RETURNED_NON_STRING")).toBe(true);
  });

  it("warns on empty string return", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) { return ''; }
        });
      `)
    );
    // Empty string is a warning, not an error
    expect(result.valid).toBe(true);
    expect(result.issues.some((i) => i.code === "RENDER_RETURNED_EMPTY")).toBe(true);
  });

  it("includes samples for valid renders", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) { return '<div>Frame ' + ctx.globalFrame + '</div>'; }
        });
      `)
    );
    expect(result.samples).toBeDefined();
    expect(result.samples!.length).toBeGreaterThan(0);
    expect(result.samples![0].html).toContain("<div>Frame");
  });

  it("warns on undeclared assets (soft validation)", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) { return '<img src="/images/icon.png">'; }
        });
      `)
    );
    expect(result.valid).toBe(true);
    expect(result.issues.some((i) => i.code === "UNDECLARED_ASSET")).toBe(true);
    const issue = result.issues.find((i) => i.code === "UNDECLARED_ASSET");
    expect(issue?.message).toContain("/images/icon.png");
  });

  it("does not warn when asset is declared in config", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          config: { assets: { icon: '/images/icon.png' } },
          render(ctx) { return '<img src="/images/icon.png">'; }
        });
      `)
    );
    expect(result.issues.some((i) => i.code === "UNDECLARED_ASSET")).toBe(false);
  });

  it("validates with custom options", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          data: { title: 'Test' },
          render(ctx) { return '<div>' + ctx.data.title + '</div>'; }
        });
      `),
      {
        width: 800,
        height: 600,
        fps: 24,
        duration: 2,
        data: { title: "Custom" },
      }
    );
    expect(result.valid).toBe(true);
  });

  it("tracks validation time", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) { return '<div>Test</div>'; }
        });
      `)
    );
    expect(result.validationTimeMs).toBeGreaterThan(0);
  });

  it("catches null in style attributes", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) {
            const value = null;
            return \`<div style="color: \${value}">Test</div>\`;
          }
        });
      `)
    );
    expect(result.issues.some((i) => i.code === "NULL_IN_OUTPUT")).toBe(true);
  });

  it("skips output checks when checkOutput is false", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) { return '<div style="left: NaN">Test</div>'; }
        });
      `),
      { checkOutput: false }
    );
    expect(result.issues.filter((i) => i.code === "ANIMATION_PRODUCES_NAN")).toHaveLength(0);
  });

  it("skips easing checks when checkEasingNames is false", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) {
            ctx.std.tween(0, 1, ctx.sceneProgress, 'badEasing');
            return '<div>OK</div>';
          }
        });
      `),
      { checkEasingNames: false }
    );
    expect(result.issues.filter((i) => i.code === "INVALID_EASING_NAME")).toHaveLength(0);
  });

  it("reports multiple issues from the same template", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) {
            const x = ctx.std.tween(0, 100, ctx.sceneProgress, 'badEasing');
            return \`<div style="left: \${0/0}px">Test</div>\`;
          }
        });
      `)
    );
    expect(result.issues.length).toBeGreaterThan(1);
  });

  it("uses custom sampleFrames", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) {
            return '<div>Frame ' + ctx.globalFrame + '</div>';
          }
        });
      `),
      { sampleFrames: [0, 1.0] }
    );
    expect(result.samples).toHaveLength(2);
  });

  it("merges template data with provided data", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          data: { name: 'Default' },
          render(ctx) { return '<div>' + ctx.data.name + '</div>'; }
        });
      `),
      { data: { name: "Override" } }
    );
    expect(result.samples?.[0]?.html).toContain("Override");
  });
});

describe("detectUndeclaredAssets", () => {
  it("extracts asset URLs from HTML", () => {
    const html = '<img src="/a.png"><video src="/b.mp4">';
    const declared = new Set(["/a.png"]);
    expect(detectUndeclaredAssets(html, declared)).toEqual(["/b.mp4"]);
  });

  it("returns empty when all assets are declared", () => {
    const html = '<img src="/a.png">';
    const declared = new Set(["/a.png"]);
    expect(detectUndeclaredAssets(html, declared)).toEqual([]);
  });
});

describe("formatValidationForAI", () => {
  it("returns VALIDATION_PASSED for valid templates", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) { return '<div>OK</div>'; }
        });
      `)
    );
    const formatted = formatValidationForAI(result);
    expect(formatted).toBe("VALIDATION_PASSED");
  });

  it("formats errors with suggestions", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) {
            const x = ctx.std.tween(0, 100, ctx.sceneProgress, 'badEasing');
            return '<div>' + x + '</div>';
          }
        });
      `)
    );
    const formatted = formatValidationForAI(result);
    expect(formatted).toContain("INVALID_EASING_NAME");
    expect(formatted).toContain("badEasing");
    expect(formatted).toContain("Fix:");
  });

  it("includes frame info for frame-specific errors", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default defineScene({
          render(ctx) {
            if (ctx.sceneProgress > 0.4) throw new Error('Crash');
            return '<div>OK</div>';
          }
        });
      `)
    );
    const formatted = formatValidationForAI(result);
    expect(formatted).toContain("frame");
    expect(formatted).toContain("%");
  });
});
