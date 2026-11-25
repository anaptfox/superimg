import { describe, it, expect } from "vitest";
import {
  validateAITemplate,
  formatValidationForAI,
  detectUndeclaredAssets,
  scanHtmlIssues,
  scanSourceFootguns,
  scanAllFramesEmpty,
  inferIsAnimated,
} from "../validation/validation.js";

function wrapDefineTemplate(code: string) {
  return `import { define, Html } from '@foxworth/superimg';\nconst box = (html) => Html({ width: 'fill', height: 'fill', html });\n${code}`;
}

describe("validateAITemplate", () => {
  it("passes for valid template", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default define({
          render(ctx) { return box('<div>Hello</div>'); }
        });
      `)
    );
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("catches syntax errors", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default define({
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
        export default define({
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
        export default define({
          render(ctx) {
            if (ctx.timeline.progress > 0.5) throw new Error('Mid-video crash');
            return box('<div>OK</div>');
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
        export default define({
          render(ctx) {
            const x = 0 / 0;
            return box(\`<div style="left: \${x}px">Test</div>\`);
          }
        });
      `)
    );
    expect(result.issues.some((i) => i.code === "ANIMATION_PRODUCES_NAN")).toBe(true);
  });

  it("catches undefined in style attributes", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default define({
          render(ctx) {
            const value = ctx.data.nonexistent;
            return box(\`<div style="color: \${value}">Test</div>\`);
          }
        });
      `)
    );
    expect(result.issues.some((i) => i.code === "UNDEFINED_IN_OUTPUT")).toBe(true);
  });

  it("catches invalid easing names", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default define({
          render(ctx) {
            const x = ctx.std.interpolate(ctx.timeline.progress, [0, 1], [0, 100], 'easeInOutBogus');
            return box(\`<div style="left: \${x}px">Test</div>\`);
          }
        });
      `)
    );
    expect(result.issues.some((i) => i.code === "INVALID_EASING_NAME")).toBe(true);
  });

  it("accepts valid easing names", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default define({
          config: { fps: 30, duration: 3 },
          render(ctx) {
            const x = ctx.std.interpolate(ctx.timeline.progress, [0, 1], [0, 100], 'easeOutCubic');
            return box(\`<div style="left: \${x}px">Test</div>\`);
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
        export default define({
          render(ctx) { return 123; }
        });
      `)
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "RENDER_RETURNED_NON_TREE")).toBe(true);
  });

  it("rejects a legacy string render root", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default define({
          render(ctx) { return '<div>legacy</div>'; }
        });
      `)
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "RENDER_RETURNED_NON_TREE")).toBe(true);
  });

  it("accepts a media tree return", async () => {
    const result = await validateAITemplate(`
      import { define, Frame, Text } from '@foxworth/superimg';
      export default define({
        render(ctx) {
          return Frame({ width: ctx.width, height: ctx.height }, Text("ok"));
        }
      });
    `);
    expect(result.issues.filter((i) => i.code === "RENDER_RETURNED_NON_TREE")).toHaveLength(0);
    expect(result.samples![0]!.html).toContain("ok");
  });

  it("rejects a plain object return", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default define({
          render(ctx) { return { foo: 1 }; }
        });
      `)
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "RENDER_RETURNED_NON_TREE")).toBe(true);
  });

  it("includes samples for valid renders", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default define({
          config: { fps: 30, duration: 2 },
          render(ctx) { return box('<div>Frame ' + ctx.timeline.frame + '</div>'); }
        });
      `)
    );
    expect(result.samples).toBeDefined();
    expect(result.samples!.length).toBeGreaterThan(0);
    expect(result.samples![0]!.html).toContain("<div>Frame");
  });

  it("warns on undeclared assets (soft validation)", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default define({
          render(ctx) { return box('<img src="/images/icon.png">'); }
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
        export default define({
          config: { assets: { icon: { url: '/images/icon.png' } } },
          render(ctx) { return box('<img src="/images/icon.png">'); }
        });
      `)
    );
    expect(result.issues.some((i) => i.code === "UNDECLARED_ASSET")).toBe(false);
  });

  it("validates with custom options", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default define({
          sample: { title: 'Test' },
          render(ctx) { return box('<div>' + ctx.data.title + '</div>'); }
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
        export default define({
          render(ctx) { return box('<div>Test</div>'); }
        });
      `)
    );
    expect(result.validationTimeMs).toBeGreaterThan(0);
  });

  it("catches null in style attributes", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default define({
          render(ctx) {
            const value = null;
            return box(\`<div style="color: \${value}">Test</div>\`);
          }
        });
      `)
    );
    expect(result.issues.some((i) => i.code === "NULL_IN_OUTPUT")).toBe(true);
  });

  it("skips output checks when checkOutput is false", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default define({
          render(ctx) { return box('<div style="left: NaN">Test</div>'); }
        });
      `),
      { checkOutput: false }
    );
    expect(result.issues.filter((i) => i.code === "ANIMATION_PRODUCES_NAN")).toHaveLength(0);
  });

  it("skips easing checks when checkEasingNames is false", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default define({
          render(ctx) {
            ctx.std.interpolate(ctx.timeline.progress, [0, 1], [0, 1], 'badEasing');
            return box('<div>OK</div>');
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
        export default define({
          render(ctx) {
            const x = ctx.std.interpolate(ctx.timeline.progress, [0, 1], [0, 100], 'badEasing');
            return box(\`<div style="left: \${0/0}px">Test</div>\`);
          }
        });
      `)
    );
    expect(result.issues.length).toBeGreaterThan(1);
  });

  it("uses custom sampleFrames", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default define({
          render(ctx) {
            return box('<div>Frame ' + ctx.globalFrame + '</div>');
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
        export default define({
          sample: { name: 'Default' },
          render(ctx) { return box('<div>' + ctx.data.name + '</div>'); }
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
        export default define({
          render(ctx) { return box('<div>OK</div>'); }
        });
      `)
    );
    const formatted = formatValidationForAI(result);
    expect(formatted).toBe("VALIDATION_PASSED");
  });

  it("formats errors with suggestions", async () => {
    const result = await validateAITemplate(
      wrapDefineTemplate(`
        export default define({
          render(ctx) {
            const x = ctx.std.interpolate(ctx.timeline.progress, [0, 1], [0, 100], 'badEasing');
            return box('<div>' + x + '</div>');
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
        export default define({
          render(ctx) {
            if (ctx.timeline.progress > 0.4) throw new Error('Crash');
            return box('<div>OK</div>');
          }
        });
      `)
    );
    const formatted = formatValidationForAI(result);
    expect(formatted).toContain("frame");
    expect(formatted).toContain("%");
  });
});

describe("scanHtmlIssues / scanSourceFootguns", () => {
  it("flags NaN in HTML", () => {
    const issues = scanHtmlIssues(`<div style="left: NaNpx">x</div>`, 0, 0);
    expect(issues.some((i) => i.code === "ANIMATION_PRODUCES_NAN")).toBe(true);
  });

  it("flags unitless motion times", () => {
    const issues = scanSourceFootguns(`const m = t.motion({ at: 0.2, for: 30 });`);
    expect(issues.some((i) => i.code === "UNITLESS_MOTION_TIME")).toBe(true);
  });

  it("does not flag unitless at as a motion time", () => {
    const issues = scanSourceFootguns(`const m = t.motion({ at: 0.2 });`);
    expect(issues.filter((i) => i.code === "UNITLESS_MOTION_TIME")).toHaveLength(0);
  });

  it("does not flag data fields named at", () => {
    const issues = scanSourceFootguns(`const log = { at: 0.12, label: "handoff" };`);
    expect(issues.filter((i) => i.code === "UNITLESS_MOTION_TIME")).toHaveLength(0);
  });

  it("allows unit-bearing motion times", () => {
    const issues = scanSourceFootguns(
      `const m = t.motion({ at: "0.2s", for: "30%" });`,
    );
    expect(issues.filter((i) => i.code === "UNITLESS_MOTION_TIME")).toHaveLength(0);
  });

  it("does not treat oscillation value ranges as motion times", () => {
    const issues = scanSourceFootguns(
      `const pulse = std.oscillate(timeline.seconds, { period: "1.2s", from: 0.55, to: 1 });`,
      { isAnimated: true },
    );
    expect(issues.filter((i) => i.code === "UNITLESS_MOTION_TIME")).toHaveLength(0);
  });

  it("still flags a unitless director clip start", () => {
    const issues = scanSourceFootguns(
      `const clip = director.clip({ from: 0.2, duration: "1s" });`,
      { isAnimated: true },
    );
    expect(issues).toEqual([
      expect.objectContaining({
        code: "UNITLESS_MOTION_TIME",
        context: "from: 0.2",
      }),
    ]);
  });

  it("flags temporal APIs on static templates", () => {
    const src = `
      export default define({
        config: { width: 1200, height: 630 },
        render(ctx) {
          const t = ctx.director();
          return '<div></div>';
        }
      });
    `;
    expect(inferIsAnimated(src)).toBe(false);
    const issues = scanSourceFootguns(src);
    expect(issues.some((i) => i.code === "TEMPORAL_API_ON_STATIC")).toBe(true);
  });

  it("does not flag director when fps+duration present", () => {
    const src = `
      export default define({
        config: { fps: 30, duration: 3 },
        render(ctx) {
          const t = ctx.director();
          return '<div></div>';
        }
      });
    `;
    const issues = scanSourceFootguns(src);
    expect(issues.filter((i) => i.code === "TEMPORAL_API_ON_STATIC")).toHaveLength(0);
  });

  it("recognizes video helper defaults without a written fps", () => {
    const source = `export default video<{ title: string }>({
      duration: "3s", render(ctx) { return ctx.director().progress; }
    });`;
    expect(inferIsAnimated(source)).toBe(true);
    expect(scanSourceFootguns(source).filter(i => i.code === "TEMPORAL_API_ON_STATIC")).toHaveLength(0);
  });

  it("flags scene-local globalFrame usage", () => {
    const issues = scanSourceFootguns(
      `export default define({ render(ctx) { return String(ctx.globalFrame); } });`,
    );
    expect(issues.some((i) => i.code === "SCENE_LOCAL_USES_GLOBAL")).toBe(true);
  });

  it("skips globalFrame warning for compose", () => {
    const issues = scanSourceFootguns(
      `export default compose([sceneA, sceneB]); function x(ctx) { return ctx.globalFrame; }`,
      { isComposed: true },
    );
    expect(issues.filter((i) => i.code === "SCENE_LOCAL_USES_GLOBAL")).toHaveLength(0);
  });

  it("flags fixed duration + stack without resolve", () => {
    const issues = scanSourceFootguns(`
      export default define({
        config: { fps: 30, duration: "8s" },
        render(ctx) {
          const s = ctx.std.stack(items, { during: t.in("main") });
          return '<div></div>';
        }
      });
    `);
    expect(issues.some((i) => i.code === "FIXED_DURATION_STACK_GROWTH")).toBe(true);
  });

  it("warns when Html() contains a raw svg", () => {
    const issues = scanSourceFootguns(`Html({ id: "mark", width: 100, height: 100, html: "<svg viewBox='0 0 10 10'></svg>" })`);
    expect(issues).toContainEqual(expect.objectContaining({ code: "RAW_SVG_IN_HTML", severity: "warning" }));
    expect(scanSourceFootguns(`Html({ html: "<div></div>" })`).some((issue) => issue.code === "RAW_SVG_IN_HTML")).toBe(false);
  });

  it("emits ALL_FRAMES_EMPTY when every sample is empty", () => {
    const issues = scanAllFramesEmpty(["", "  ", "\n"]);
    expect(issues.some((i) => i.code === "ALL_FRAMES_EMPTY")).toBe(true);
  });

  it("does not emit ALL_FRAMES_EMPTY when any sample has content", () => {
    expect(scanAllFramesEmpty(["", "<div>ok</div>", ""])).toHaveLength(0);
  });
});
