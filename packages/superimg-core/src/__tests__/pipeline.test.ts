import { describe, it, expect } from "vitest";
import { compileFromString, makeTestContext, makeTestContextAtProgress } from "./__test-utils__/index.js";

describe("render pipeline integration", () => {
  it("renders template at keyframes with correct timeline.progress", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        config: { fps: 2, duration: 1, width: 640, height: 360 },
        render(ctx) {
          return '<div style="opacity: ' + ctx.timeline.progress + '">Frame</div>';
        }
      });
    `;
    const { template } = await compileFromString(code);
    expect(template).toBeDefined();

    const frames = [0, 0.5, 1].map((progress) =>
      template!.render(makeTestContextAtProgress(progress))
    );
    expect(frames[0]).toContain("opacity: 0");
    expect(frames[1]).toContain("opacity: 0.5");
    expect(frames[2]).toContain("opacity: 1");
  });

  it("merges data with ctx.data", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        sample: { title: 'Default' },
        render(ctx) { return '<div>' + ctx.data.title + '</div>'; }
      });
    `;
    const { template } = await compileFromString(code);
    const ctx = makeTestContext({ data: { title: "Override" } });
    const html = template!.render(ctx);
    expect(html).toContain("Override");
  });

  it("uses stdlib interpolate in output", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        render(ctx) {
          const eased = ctx.std.interpolate(ctx.timeline.progress, [0, 1], [0, 1], 'easeOutCubic');
          return '<div data-eased="' + eased + '"></div>';
        }
      });
    `;
    const { template } = await compileFromString(code);
    const html = template!.render(makeTestContextAtProgress(0.5));
    expect(html).toContain('data-eased="');
    const match = html.match(/data-eased="([^"]+)"/);
    expect(match).toBeTruthy();
    const eased = parseFloat(match![1]!);
    expect(eased).toBeGreaterThan(0.5);
    expect(eased).toBeLessThanOrEqual(1);
  });
});
