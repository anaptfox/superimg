import { describe, it, expect } from "vitest";
import { compileFromString, makeTestContext } from "./__test-utils__/index.js";

describe("render pipeline integration", () => {
  it("renders template at keyframes with correct sceneProgress", async () => {
    const code = `
      import { defineTemplate } from 'superimg';
      export default defineTemplate({
        config: { fps: 2, durationSeconds: 1, width: 640, height: 360 },
        render(ctx) {
          return '<div style="opacity: ' + ctx.sceneProgress + '">Frame</div>';
        }
      });
    `;
    const { template } = await compileFromString(code);
    expect(template).toBeDefined();

    const frames = [0, 0.5, 1].map((progress) =>
      template!.render(makeTestContext({ sceneProgress: progress }))
    );
    expect(frames[0]).toContain("opacity: 0");
    expect(frames[1]).toContain("opacity: 0.5");
    expect(frames[2]).toContain("opacity: 1");
  });

  it("merges defaults with ctx.data", async () => {
    const code = `
      import { defineTemplate } from 'superimg';
      export default defineTemplate({
        defaults: { title: 'Default' },
        render(ctx) { return '<div>' + ctx.data.title + '</div>'; }
      });
    `;
    const { template } = await compileFromString(code);
    const ctx = makeTestContext({ data: { title: "Override" } });
    const html = template!.render(ctx);
    expect(html).toContain("Override");
  });

  it("uses stdlib tween in output", async () => {
    const code = `
      import { defineTemplate } from 'superimg';
      export default defineTemplate({
        render(ctx) {
          const eased = ctx.std.tween(0, 1, ctx.sceneProgress, 'easeOutCubic');
          return '<div data-eased="' + eased + '"></div>';
        }
      });
    `;
    const { template } = await compileFromString(code);
    const html = template!.render(makeTestContext({ sceneProgress: 0.5 }));
    expect(html).toContain('data-eased="');
    const match = html.match(/data-eased="([^"]+)"/);
    expect(match).toBeTruthy();
    const eased = parseFloat(match![1]);
    expect(eased).toBeGreaterThan(0.5);
    expect(eased).toBeLessThanOrEqual(1);
  });
});
